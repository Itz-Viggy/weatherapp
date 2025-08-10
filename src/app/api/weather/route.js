import { NextResponse } from "next/server";



const isValidUSZip = (z) => /^\d{5}$/.test(z?.trim());

function normalize(now, fc) {
  const nowOut = {
    city: now.name,
    temp: Math.round(now.main.temp),
    feelsLike: Math.round(now.main.feels_like),
    description: now.weather?.[0]?.description ?? "—",
    icon: now.weather?.[0]?.icon ?? "01d",
    windMph: Math.round(now.wind?.speed ?? 0),
    humidity: now.main?.humidity ?? 0,
    time: new Date(now.dt * 1000).toISOString(),
  };

  const byDate = {};
  for (const e of fc.list ?? []) {
    const dateKey = new Date(e.dt * 1000).toISOString().slice(0, 10);
    (byDate[dateKey] ||= []).push(e);
  }

  const forecast = Object.keys(byDate).slice(0, 5).map((k) => {
    const entries = byDate[k];
    const hi = Math.round(Math.max(...entries.map((x) => x.main.temp_max)));
    const lo = Math.round(Math.min(...entries.map((x) => x.main.temp_min)));
    const repr = entries
      .slice()
      .sort(
        (a, b) =>
          Math.abs(12 - new Date(a.dt * 1000).getHours()) -
          Math.abs(12 - new Date(b.dt * 1000).getHours())
      )[0];
    return {
      date: k,
      hi,
      lo,
      description: repr.weather?.[0]?.description ?? "—",
      icon: repr.weather?.[0]?.icon ?? "01d",
    };
  });

  return { now: nowOut, forecast };
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const zip = searchParams.get("zip")?.trim();
  const lat = searchParams.get("lat");
  const lon = searchParams.get("lon");

  
  if (zip) {
    if (!isValidUSZip(zip)) {
      return NextResponse.json({ error: "Enter a valid 5-digit US ZIP." }, { status: 400 });
    }
  } else if (lat && lon) {
    if (isNaN(lat) || isNaN(lon)) {
      return NextResponse.json({ error: "Invalid coordinates." }, { status: 400 });
    }
  } else {
    return NextResponse.json({ error: "Either ZIP code or coordinates required." }, { status: 400 });
  }

  const key = process.env.OPENWEATHER_API_KEY;
  if (!key) {
    return NextResponse.json(
      { error: "Server missing OPENWEATHER_API_KEY. Add it to .env.local and restart." },
      { status: 500 }
    );
  }

  
  let nowUrl, fcUrl;
  if (zip) {
    nowUrl = `https://api.openweathermap.org/data/2.5/weather?zip=${zip},US&units=imperial&appid=${key}`;
    fcUrl = `https://api.openweathermap.org/data/2.5/forecast?zip=${zip},US&units=imperial&appid=${key}`;
  } else {
    nowUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=imperial&appid=${key}`;
    fcUrl = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&units=imperial&appid=${key}`;
  }

  try {
    const [nowRes, fcRes] = await Promise.all([
      fetch(nowUrl),
      fetch(fcUrl),
    ]);

    const nowText = await nowRes.text();
    const fcText = await fcRes.text();

    if (!nowRes.ok || !fcRes.ok) {
      const errorMsg = (() => {
        try {
          const error = JSON.parse(nowText || fcText || "{}");
          return error.message || "Weather service unavailable";
        } catch {
          return "Weather service unavailable";
        }
      })();

      return NextResponse.json({ error: errorMsg }, { status: 502 });
    }

    const nowRaw = JSON.parse(nowText);
    const fcRaw  = JSON.parse(fcText);

    const data = normalize(nowRaw, fcRaw);

    return NextResponse.json({ ...data, source: "openweathermap" });
  } catch (e) {
    return NextResponse.json({ error: "Unable to fetch weather data" }, { status: 500 });
  }
}
