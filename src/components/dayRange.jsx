"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

function isoPlusDays(iso, delta) {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

export default function dayRange({ id, start, end }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [err, setErr] = useState("");

  async function patchDateRange(newStart, newEnd) {
    setPending(true);
    setErr("");
    try {
      const res = await fetch(`/api/queries/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dateRange: { start: newStart, end: newEnd } }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Update failed");
      router.refresh();
    } catch (e) {
      setErr(e.message);
    } finally {
      setPending(false);
    }
  }

  async function handleExtend() {
    const newEnd = isoPlusDays(end, 1);
    await patchDateRange(start, newEnd);
  }

  async function handleReduce() {
    const newEnd = isoPlusDays(end, -1);
    const startTs = Date.parse(start + "T00:00:00Z");
    const endTs   = Date.parse(newEnd + "T00:00:00Z");
    if (endTs < startTs) {
      setErr("At least 1 day must remain.");
      return;
    }
    await patchDateRange(start, newEnd);
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleExtend}
        disabled={pending}
        className="rounded-xl border px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-60"
      >
        Extend +1 day
      </button>
      <button
        onClick={handleReduce}
        disabled={pending}
        className="rounded-xl border px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-60"
      >
        Reduce −1 day
      </button>
      {pending && <span className="text-xs text-gray-500">Updating…</span>}
      {err && <span className="text-xs text-red-600">{err}</span>}
    </div>
  );
}
