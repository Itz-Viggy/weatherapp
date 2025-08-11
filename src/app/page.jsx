"use client";
import { useState, useEffect } from "react";

export default function Page() {
  const [zip, setZip] = useState("");
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [adv, setAdv] = useState({
    type: "zip",
    zip: "",
    q: "",
    lat: "",
    lon: "",
    start: "",
    end: "",
    units: "imperial",
    notes: ""
  });
  const [advError, setAdvError] = useState("");
  const [advLoading, setAdvLoading] = useState(false);
  const [advResult, setAdvResult] = useState(null);
  const [saved, setSaved] = useState([]);

  async function loadSaved() {
    const res = await fetch("/api/queries");
    const json = await res.json();
    if (res.ok) setSaved(json);
  }
  useEffect(() => { loadSaved(); }, []);

  async function createAdvanced(e) {
    e?.preventDefault?.();
    setAdvError(""); setAdvLoading(true); setAdvResult(null);

    try {
      const location =
        adv.type === "zip" ? { type:"zip", zip: adv.zip.trim() } :
        adv.type === "q"   ? { type:"q",   q: adv.q.trim() } :
                             { type:"coords", lat: parseFloat(adv.lat), lon: parseFloat(adv.lon) };

      const body = {
        location,
        dateRange: { start: adv.start, end: adv.end },
        units: adv.units,
        notes: adv.notes
      };

      const res = await fetch("/api/queries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to save");
      setAdvResult(json);
      await loadSaved();
    } catch (err) {
      setAdvError(err.message);
    } finally {
      setAdvLoading(false);
    }
  }

  async function deleteSaved(id) {
    const res = await fetch(`/api/queries/${id}`, { method: "DELETE" });
    if (res.ok) {
      setSaved(s => s.filter(x => x.id !== id));
      if (advResult?.id === id) setAdvResult(null);
    }
  }

  async function viewSaved(id) {
    const res = await fetch(`/api/queries/${id}`);
    const json = await res.json();
    if (res.ok) setAdvResult(json);
  }

  async function updateSaved(id, updates) {
    const res = await fetch(`/api/queries/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates)
    });
    const json = await res.json();
    if (!res.ok) {
      alert(json.error || "Update failed");
      return;
    }
    setAdvResult(json);
    await loadSaved();
  }

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
          
          const locationRes = await fetch(`/api/location?lat=${latitude}&lon=${longitude}`);
          const locationData = await locationRes.json();
          
          if (!locationRes.ok) {
            throw new Error(locationData.error || "Unable to get location");
          }

          if (locationData.zip) {
            setZip(locationData.zip);
            
            const weatherRes = await fetch(`/api/weather?zip=${locationData.zip}`);
            const weatherData = await weatherRes.json();
            
            if (!weatherRes.ok) {
              throw new Error(weatherData.error || "Failed to get weather");
            }
            
            setData(weatherData);
          } else {
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

        <div className="flex justify-end">
          <a href="/saved" className="text-sm text-blue-600 hover:underline">
            Saved queries →
          </a>
        </div>

      
        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <details className="group" open>
            <summary className="flex cursor-pointer items-center justify-between">
              <span className="text-lg font-semibold">Advanced search</span>
              <span className="text-sm text-gray-500 group-open:hidden">create • read • update • delete</span>
            </summary>

            <form onSubmit={createAdvanced} className="mt-4 space-y-4">
              <div className="flex flex-wrap gap-3">
                <label className={`px-3 py-1.5 rounded-xl border ${adv.type==="zip"?"border-blue-500 bg-blue-50":"border-gray-300"}`}>
                  <input type="radio" name="locType" className="mr-2" checked={adv.type==="zip"} onChange={() => setAdv(a=>({...a,type:"zip"}))}/>
                  ZIP
                </label>
                <label className={`px-3 py-1.5 rounded-xl border ${adv.type==="q"?"border-blue-500 bg-blue-50":"border-gray-300"}`}>
                  <input type="radio" name="locType" className="mr-2" checked={adv.type==="q"} onChange={() => setAdv(a=>({...a,type:"q"}))}/>
                  Place name (city, state, country)
                </label>
                <label className={`px-3 py-1.5 rounded-xl border ${adv.type==="coords"?"border-blue-500 bg-blue-50":"border-gray-300"}`}>
                  <input type="radio" name="locType" className="mr-2" checked={adv.type==="coords"} onChange={() => setAdv(a=>({...a,type:"coords"}))}/>
                  Coordinates
                </label>
              </div>

              {adv.type === "zip" && (
                <input
                  value={adv.zip}
                  onChange={e=>setAdv(a=>({...a,zip:e.target.value}))}
                  placeholder="ZIP (e.g., 33411)"
                  inputMode="numeric"
                  maxLength={5}
                  className="w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5"
                />
              )}
              {adv.type === "q" && (
                <input
                  value={adv.q}
                  onChange={e=>setAdv(a=>({...a,q:e.target.value}))}
                  placeholder="City, State, Country (e.g., Miami, FL, US)"
                  className="w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5"
                />
              )}
              {adv.type === "coords" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    value={adv.lat}
                    onChange={e=>setAdv(a=>({...a,lat:e.target.value}))}
                    placeholder="Latitude"
                    className="rounded-xl border border-gray-300 bg-white px-4 py-2.5"
                  />
                  <input
                    value={adv.lon}
                    onChange={e=>setAdv(a=>({...a,lon:e.target.value}))}
                    placeholder="Longitude"
                    className="rounded-xl border border-gray-300 bg-white px-4 py-2.5"
                  />
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="date"
                  value={adv.start}
                  onChange={e=>setAdv(a=>({...a,start:e.target.value}))}
                  className="rounded-xl border border-gray-300 bg-white px-4 py-2.5"
                  placeholder="Start date"
                />
                <input
                  type="date"
                  value={adv.end}
                  onChange={e=>setAdv(a=>({...a,end:e.target.value}))}
                  className="rounded-xl border border-gray-300 bg-white px-4 py-2.5"
                  placeholder="End date"
                />
              </div>

              <input
                value={adv.notes}
                onChange={e=>setAdv(a=>({...a,notes:e.target.value}))}
                placeholder="Notes (optional)"
                className="w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5"
              />

              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  disabled={advLoading}
                  className="rounded-xl bg-emerald-600 px-4 py-2.5 text-white font-medium hover:bg-emerald-700"
                >
                  {advLoading ? "Saving…" : "Save & Fetch"}
                </button>
                {advError && <span className="text-sm text-red-600">{advError}</span>}
              </div>
            </form>

            {advResult && (
              <div className="mt-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-gray-600">
                      {advResult.normalized_location?.city
                        ? `${advResult.normalized_location.city}${advResult.normalized_location.state ? ", " + advResult.normalized_location.state : ""}, ${advResult.normalized_location.country}`
                        : "Selected location"}
                    </div>
                    <div className="text-xs text-gray-500">
                      {advResult.start_date} → {advResult.end_date}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm">
                      <strong>Min:</strong> {advResult.result?.summary?.min}°
                      <span className="mx-2">|</span>
                      <strong>Avg:</strong> {advResult.result?.summary?.avg}°
                      <span className="mx-2">|</span>
                      <strong>Max:</strong> {advResult.result?.summary?.max}°
                    </div>
                    
                  </div>
                </div>

                <div className="border border-gray-100 rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="p-2 text-left">Date</th>
                        <th className="p-2 text-left">High</th>
                        <th className="p-2 text-left">Low</th>
                        <th className="p-2 text-left">Avg</th>
                        <th className="p-2 text-left">Weather</th>
                      </tr>
                    </thead>
                    <tbody>
                      {advResult.result?.series?.map((s) => (
                        <tr key={s.date} className="odd:bg-white even:bg-gray-50">
                          <td className="p-2">{s.date}</td>
                          <td className="p-2">{s.hi}°</td>
                          <td className="p-2">{s.lo}°</td>
                          <td className="p-2">{s.avg}°</td>
                          <td className="p-2 flex items-center gap-2 capitalize">
                            <img src={`https://openweathermap.org/img/wn/${s.icon}.png`} alt="" className="h-5 w-5"/>
                            {s.desc}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => {
                      const end = new Date(advResult.end_date + "T00:00:00Z");
                      const plus1 = new Date(end.getTime() + 24*3600*1000).toISOString().slice(0,10);
                      updateSaved(advResult.id, { dateRange: { start: advResult.start_date, end: plus1 } });
                    }}
                    className="rounded-xl border px-3 py-1.5"
                  >
                    Extend +1 day
                  </button>
                  <button
                    onClick={() => deleteSaved(advResult.id)}
                    className="rounded-xl border px-3 py-1.5 text-red-600 border-red-300"
                  >
                    Delete
                  </button>
                </div>
              </div>
            )}
          </details>
        </section>
      </div>
    </main>
  );
}
