export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const key = process.env.OPENWEATHER_API_KEY;
const isValidUSZip = (z) => /^\d{5}$/.test(String(z || "").trim());

function toUtcStart(d) { return new Date(`${d}T00:00:00Z`); }
function toUtcEnd(d)   { return new Date(`${d}T23:59:59Z`); }

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

export async function GET(_req, { params }) {
  const { id } = params;
  const { data, error } = await supabaseAdmin.from("weather_queries").select("*").eq("id", id).single();
  if (error) return NextResponse.json({ error: error.message }, { status: 404 });
  return NextResponse.json(data);
}


export async function PATCH(req, { params }) {
  if (!key) return NextResponse.json({ error: "Server missing OPENWEATHER_API_KEY" }, { status: 500 });

  const { id } = params;

  try {
    const body = await req.json();
    const updates = {};
    let lat, lon, normalized;

    if (body.location) {
      const type = body.location.type;
      if (!["zip","coords","q"].includes(type)) throw new Error("location.type must be zip | coords | q");

      if (type === "zip") {
        if (!isValidUSZip(body.location.zip)) throw new Error("Enter a valid 5-digit US ZIP.");
        normalized = await geocodeByZip(body.location.zip);
      } else if (type === "coords") {
        const { lat: la, lon: lo } = body.location;
        if (Number.isNaN(+la) || Number.isNaN(+lo)) throw new Error("Invalid coordinates.");
        const rev = `https://api.openweathermap.org/geo/1.0/reverse?lat=${la}&lon=${lo}&limit=1&appid=${key}`;
        const r = await fetch(rev);
        const arr = r.ok ? await r.json() : [];
        const loc = arr?.[0];
        normalized = {
          city: loc?.name ?? null,
          state: loc?.state ?? null,
          country: loc?.country ?? null,
          lat: +la, lon: +lo, zip: null
        };
      } else {
        normalized = await geocodeByQuery(body.location.q);
      }
      updates.location_input = body.location;
      updates.normalized_location = normalized;
      lat = normalized.lat; lon = normalized.lon;
    }

    if (body.dateRange) {
      const { start, end } = body.dateRange;
      if (!start || !end) throw new Error("Both start and end dates are required.");
      const s = toUtcStart(start);
      const e = toUtcEnd(end);
      if (s > e) throw new Error("start must be on/before end.");
      updates.start_date = new Date(s.toISOString().slice(0,10));
      updates.end_date   = new Date(e.toISOString().slice(0,10));
    }

    if (typeof body.notes === "string") updates.notes = body.notes;

    const { data: existing, error: exErr } = await supabaseAdmin.from("weather_queries").select("*").eq("id", id).single();
    if (exErr) throw new Error(exErr.message);

    const finalUnits = existing.units;
    const startUTC = toUtcStart((updates.start_date || existing.start_date).toISOString().slice(0,10));
    const endUTC   = toUtcEnd((updates.end_date   || existing.end_date).toISOString().slice(0,10));

    const useLat = lat ?? existing.normalized_location?.lat;
    const useLon = lon ?? existing.normalized_location?.lon;

    const { summary, series, normalized_location: normFromFc } =
      await getRangeTemps({ lat: useLat, lon: useLon, units: finalUnits, startUTC, endUTC });

    updates.result = { summary, series };
    updates.normalized_location = {
      ...(updates.normalized_location || existing.normalized_location),
      city: (updates.normalized_location?.city ?? existing.normalized_location?.city) ?? normFromFc.city,
      state: updates.normalized_location?.state ?? existing.normalized_location?.state ?? null,
      country: (updates.normalized_location?.country ?? existing.normalized_location?.country) ?? normFromFc.country,
      lat: useLat, lon: useLon,
      zip: updates.normalized_location?.zip ?? existing.normalized_location?.zip ?? null
    };

    const { data, error } = await supabaseAdmin
      .from("weather_queries")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: e.message || "Failed to update query" }, { status: 400 });
  }
}

export async function DELETE(_req, { params }) {
  const { id } = params;
  const { error } = await supabaseAdmin.from("weather_queries").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
