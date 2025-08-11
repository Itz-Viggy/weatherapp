export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const isValidUSZip = (z) => /^\d{5}$/.test(String(z || "").trim());
const key = process.env.OPENWEATHER_API_KEY;

function toUtcStart(endpoints) {
  return new Date(`${endpoints}T00:00:00Z`);
}
function toUtcEnd(endpoints) {
  return new Date(`${endpoints}T23:59:59Z`);
}

async function geocodeByQuery(q) {
  const url = `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(q)}&limit=1&appid=${key}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Geocoding failed");
  const arr = await res.json();
  if (!arr.length) throw new Error("Location not found");
  const g = arr[0];
  return { city: g.name, state: g.state ?? null, country: g.country, lat: g.lat, lon: g.lon, zip: null };
}

async function geocodeByZip(zip) {
  const url = `https://api.openweathermap.org/geo/1.0/zip?zip=${zip},US&appid=${key}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Invalid ZIP");
  const g = await res.json();
  return { city: g.name, state: null, country: g.country, lat: g.lat, lon: g.lon, zip };
}

async function getRangeTemps({ lat, lon, units, startUTC, endUTC }) {
  const fcUrl = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&units=${units}&appid=${key}`;
  const res = await fetch(fcUrl);
  const text = await res.text();
  if (!res.ok) {
    let message = "Weather service unavailable";
    try { message = JSON.parse(text)?.message || message; } catch {}
    throw new Error(message);
  }
  const fc = JSON.parse(text);

  const list = Array.isArray(fc.list) ? fc.list : [];
  if (!list.length) throw new Error("No forecast data");

  const tzOffsetSec = Number(fc.city?.timezone ?? 0);
  const tzOffsetMs = tzOffsetSec * 1000;

  const startUTCWindowMs = startUTC.getTime() - tzOffsetMs;
  const endUTCWindowMs   = endUTC.getTime()   - tzOffsetMs;

  const firstMs = list[0].dt * 1000;
  const lastMs  = list[list.length - 1].dt * 1000;
  if (endUTCWindowMs < firstMs || startUTCWindowMs > lastMs) {
    throw new Error("Requested date range is outside the 5-day forecast window.");
  }

  const inRange = list.filter(x => {
    const tUTCms = x.dt * 1000;
    return tUTCms >= startUTCWindowMs && tUTCms <= endUTCWindowMs;
  });

  if (!inRange.length) {
    throw new Error("No forecast points in that date range (try adjusting by a day).");
  }

  const byLocalDate = {};
  for (const e of inRange) {
    const local = new Date(e.dt * 1000 + tzOffsetMs);
    const dateKey = local.toISOString().slice(0, 10);
    (byLocalDate[dateKey] ||= []).push({ e, local });
  }

  const daily = Object.keys(byLocalDate).sort().map(d => {
    const entries = byLocalDate[d];

    const highs = entries.map(({ e }) => Number.isFinite(e.main?.temp_max) ? e.main.temp_max : e.main?.temp ?? 0);
    const lows  = entries.map(({ e }) => Number.isFinite(e.main?.temp_min) ? e.main.temp_min : e.main?.temp ?? 0);
    const mids  = entries.map(({ e }) => e.main?.temp ?? 0);

    const hi  = Math.round(Math.max(...highs));
    const lo  = Math.round(Math.min(...lows));
    const avg = Math.round(mids.reduce((a,b)=>a+b,0) / mids.length);

    const repr = entries
      .slice()
      .sort((a, b) => Math.abs(12 - a.local.getUTCHours()) - Math.abs(12 - b.local.getUTCHours()))[0].e;

    return {
      date: d,
      hi, lo, avg,
      desc: repr.weather?.[0]?.description ?? "—",
      icon: repr.weather?.[0]?.icon ?? "01d",
    };
  });

  if (!daily.length) throw new Error("No daily aggregates for that range.");

  const dayHighs = daily.map(x => x.hi);
  const dayLows  = daily.map(x => x.lo);
  const summary = {
    min: Math.min(...dayLows),
    max: Math.max(...dayHighs),
    avg: Math.round(daily.reduce((s,x)=>s+x.avg,0) / daily.length),
    count: daily.length,
  };

  const city = fc.city?.name ?? null;
  const country = fc.city?.country ?? null;
  const norm = { city, state: null, country, lat, lon, zip: null };

  return { summary, series: daily, normalized_location: norm };
}

function validatePayload(body) {
  const { location, dateRange, units = "imperial", notes } = body || {};
  if (!location || !dateRange) throw new Error("location and dateRange are required");

  const { type } = location;
  if (!["zip","coords","q"].includes(type)) throw new Error("location.type must be zip | coords | q");

  if (type === "zip" && !isValidUSZip(location.zip)) throw new Error("Enter a valid 5-digit US ZIP.");
  if (type === "coords") {
    const { lat, lon } = location;
    if (Number.isNaN(+lat) || Number.isNaN(+lon)) throw new Error("Invalid coordinates.");
  }
  if (type === "q" && !String(location.q || "").trim()) throw new Error("Search text required");

  const { start, end } = dateRange;
  if (!start || !end) throw new Error("Both start and end dates are required (YYYY-MM-DD).");
  const startUTC = toUtcStart(start);
  const endUTC   = toUtcEnd(end);
  if (isNaN(startUTC) || isNaN(endUTC)) throw new Error("Invalid date format (use YYYY-MM-DD).");
  if (startUTC > endUTC) throw new Error("start must be on/before end.");

  if (!["imperial","metric","standard"].includes(units)) throw new Error("units must be imperial | metric | standard");
  return { startUTC, endUTC, units, notes };
}

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("weather_queries")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req) {
  if (!key) return NextResponse.json({ error: "Server missing OPENWEATHER_API_KEY" }, { status: 500 });    try {
    const body = await req.json();
    const { startUTC, endUTC, units, notes } = validatePayload(body);

    let normalized;
    if (body.location.type === "zip") {
      normalized = await geocodeByZip(body.location.zip);
    } else if (body.location.type === "coords") {
      const { lat, lon } = body.location;
      const rev = `https://api.openweathermap.org/geo/1.0/reverse?lat=${lat}&lon=${lon}&limit=1&appid=${key}`;
      const r = await fetch(rev);
      const arr = r.ok ? await r.json() : [];
      const loc = arr?.[0];
      normalized = {
        city: loc?.name ?? null,
        state: loc?.state ?? null,
        country: loc?.country ?? null,
        lat: +lat, lon: +lon, zip: null
      };
    } else {
      normalized = await geocodeByQuery(body.location.q);
    }

    const { summary, series, normalized_location: normFromFc } = await getRangeTemps({
      lat: normalized.lat,
      lon: normalized.lon,
      units,
      startUTC,
      endUTC
    });

    const normalized_location = {
      ...normFromFc,
      city: normalized.city ?? normFromFc.city,
      state: normalized.state ?? normFromFc.state ?? null,
      country: normalized.country ?? normFromFc.country,
      lat: normalized.lat,
      lon: normalized.lon,
      zip: normalized.zip ?? null
    };

    const payload = {
      location_input: body.location,
      normalized_location,
      start_date: new Date(startUTC.toISOString().slice(0,10)),
      end_date: new Date(endUTC.toISOString().slice(0,10)),
      units,
      source: "openweathermap",
      result: { summary, series },
      notes: notes ?? null
    };

    const { data, error } = await supabaseAdmin.from("weather_queries").insert(payload).select().single();
    if (error) throw new Error(error.message);

    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: e.message || "Failed to create query" }, { status: 400 });
  }
}
