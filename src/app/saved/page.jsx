"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function SavedPage() {
  const [saved, setSaved] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  async function load() {
    try {
      setLoading(true);
      const res = await fetch("/api/queries", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load");
      setSaved(json);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleDelete(id) {
    const res = await fetch(`/api/queries/${id}`, { method: "DELETE" });
    if (res.ok) setSaved(s => s.filter(x => x.id !== id));
  }

  return (
    <main className="min-h-screen bg-gray-50 text-gray-900">
      <div className="mx-auto max-w-3xl p-6 md:p-10 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Saved queries</h1>
          <Link href="/" className="text-sm text-blue-600 hover:underline">← Back</Link>
        </div>

        {loading && <p className="text-sm text-gray-600">Loading…</p>}
        {err && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>}

        {!loading && !saved.length && (
          <p className="text-sm text-gray-500">No saved queries yet.</p>
        )}

        <div className="grid gap-2">
          {saved.map((q) => (
            <div key={q.id} className="flex items-center justify-between rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="text-sm">
                <div className="font-medium">
                  {q.normalized_location?.city
                    ? `${q.normalized_location.city}${q.normalized_location.state ? ", " + q.normalized_location.state : ""}, ${q.normalized_location.country}`
                    : (q.location_input?.type === "zip" ? `ZIP ${q.location_input.zip}` :
                       q.location_input?.type === "q" ? q.location_input.q :
                       `(${q.location_input.lat}, ${q.location_input.lon})`)}
                </div>
                <div className="text-xs text-gray-600">
                  {q.start_date} → {q.end_date} • {q.units}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Link href={`/saved/${q.id}`} className="rounded-lg border px-2.5 py-1.5 text-sm hover:bg-gray-50">
                  View
                </Link>
                <button
                  onClick={() => handleDelete(q.id)}
                  className="rounded-lg border px-2.5 py-1.5 text-sm text-red-600 border-red-300 hover:bg-red-50"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
