"use client";
import { useState } from "react";

export default function Page() {
  const [zip, setZip] = useState("");
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!/^\d{5}$/.test(zip.trim())) {
      setError("Enter a valid 5-digit US ZIP.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`/api/weather?zip=${zip.trim()}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed");
      setData(json);
    } catch (e) {
      setError(e.message);
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  async function handleCurrentLocation() {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by this browser");
      return;
    }

    setError("");
    setLoading(true);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          
          // Get location info from coordinates
          const locationRes = await fetch(`/api/location?lat=${latitude}&lon=${longitude}`);
          const locationData = await locationRes.json();
          
          if (!locationRes.ok) {
            throw new Error(locationData.error || "Unable to get location");
          }

          // If we got a ZIP code, use it directly
          if (locationData.zip) {
            setZip(locationData.zip);
            
            // Fetch weather for this ZIP
            const weatherRes = await fetch(`/api/weather?zip=${locationData.zip}`);
            const weatherData = await weatherRes.json();
            
            if (!weatherRes.ok) {
              throw new Error(weatherData.error || "Failed to get weather");
            }
            
            setData(weatherData);
          } else {
            // Fallback: use coordinates directly for weather
            const weatherRes = await fetch(`/api/weather?lat=${latitude}&lon=${longitude}`);
            const weatherData = await weatherRes.json();
            
            if (!weatherRes.ok) {
              throw new Error(weatherData.error || "Failed to get weather");
            }
            
            setData(weatherData);
          }
        } catch (e) {
          setError(e.message);
          setData(null);
        } finally {
          setLoading(false);
        }
      },
      (error) => {
        setLoading(false);
        switch (error.code) {
          case error.PERMISSION_DENIED:
            setError("Location access denied by user");
            break;
          case error.POSITION_UNAVAILABLE:
            setError("Location information unavailable");
            break;
          case error.TIMEOUT:
            setError("Location request timed out");
            break;
          default:
            setError("Unable to get location");
            break;
        }
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 text-gray-900">
      <div className="mx-auto max-w-xl p-6 md:p-10 space-y-6">
        <h1 className="text-3xl font-semibold tracking-tight">Weather</h1>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="flex items-center gap-3">
            <input
              value={zip}
              onChange={(e) => setZip(e.target.value)}
              placeholder="ZIP (e.g., 33411)"
              inputMode="numeric"
              maxLength={5}
              className="w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-base shadow-sm outline-none ring-0 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
            />
            <button
              type="submit"
              className="shrink-0 rounded-xl bg-blue-600 px-4 py-2.5 text-white font-medium shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-300 active:bg-blue-800"
            >
              Get Weather
            </button>
          </div>
          
          <div className="flex justify-center">
            <button
              type="button"
              onClick={handleCurrentLocation}
              disabled={loading}
              className="text-sm text-blue-600 hover:text-blue-700 focus:outline-none focus:underline disabled:text-gray-400"
            >
              📍 Use Current Location
            </button>
          </div>
        </form>

        {loading && <p className="text-sm text-gray-600">Loading…</p>}
        {error && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        {data && (
          <div className="space-y-6">
            <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">{data.now.city}</h2>
                <img
                  src={`https://openweathermap.org/img/wn/${data.now.icon}@2x.png`}
                  alt={data.now.description}
                  className="h-14 w-14"
                />
              </div>
              <p className="mt-1 capitalize text-gray-700">{data.now.description}</p>
              <p className="mt-2 text-3xl font-bold">
                {data.now.temp}°F{" "}
                <span className="ml-1 text-base font-medium text-gray-600">
                  (feels {data.now.feelsLike}°F)
                </span>
              </p>
              <p className="mt-2 text-sm text-gray-600">
                Wind {data.now.windMph} mph • Humidity {data.now.humidity}%
              </p>
            </section>

            <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <h3 className="text-lg font-semibold">5-Day Forecast</h3>
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {data.forecast.map((d) => (
                  <div
                    key={d.date}
                    className="flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50 p-4"
                  >
                    <div>
                      <div className="text-sm font-medium text-gray-700">{d.date}</div>
                      <div className="mt-1 text-sm text-gray-600 capitalize">{d.description}</div>
                      <div className="mt-1 text-base font-semibold">
                        {d.hi}° / {d.lo}°
                      </div>
                    </div>
                    <img
                      src={`https://openweathermap.org/img/wn/${d.icon}.png`}
                      alt={d.description}
                      className="h-10 w-10"
                    />
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
