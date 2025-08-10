import { NextResponse } from "next/server";

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const lat = searchParams.get("lat");
  const lon = searchParams.get("lon");

  if (!lat || !lon) {
    return NextResponse.json({ error: "Missing latitude or longitude" }, { status: 400 });
  }

  const key = process.env.OPENWEATHER_API_KEY;
  if (!key) {
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }

  try {
    const url = `https://api.openweathermap.org/geo/1.0/reverse?lat=${lat}&lon=${lon}&limit=1&appid=${key}`;
    const res = await fetch(url);
    
    if (!res.ok) {
      return NextResponse.json({ error: "Unable to get location" }, { status: 502 });
    }

    const data = await res.json();
    if (!data.length) {
      return NextResponse.json({ error: "Location not found" }, { status: 404 });
    }

    const location = data[0];
    return NextResponse.json({
      city: location.name,
      state: location.state,
      country: location.country,
      zip: location.zip || null
    });
  } catch (e) {
    return NextResponse.json({ error: "Unable to get location" }, { status: 500 });
  }
}
