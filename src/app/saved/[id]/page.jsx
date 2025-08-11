import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { notFound } from "next/navigation";
import DayRange from "@/components/dayRange";
export default async function SavedDetailPage({ params }) {
  const { id } = params;

  const { data, error } = await supabaseAdmin
    .from("weather_queries")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) {
    notFound();
  }

  const loc = data.normalized_location;
  return (
    <main className="min-h-screen bg-gray-50 text-gray-900">
      <div className="mx-auto max-w-3xl p-6 md:p-10 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">
            {loc?.city
              ? `${loc.city}${loc.state ? ", " + loc.state : ""}, ${loc.country}`
              : "Saved query"}
          </h1>
          <div className="flex items-center gap-3">
            <Link href="/saved" className="text-sm text-blue-600 hover:underline">← All saved</Link>
            <Link href="/" className="text-sm text-blue-600 hover:underline">Home</Link>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm text-gray-600">
              {data.start_date} → {data.end_date} • {data.units}
            </div>
            {data.source && <div className="text-xs text-gray-500">source: {data.source}</div>}
          </div>
        
        <div className="mt-3">
            <DayRange id={data.id} start={data.start_date} end={data.end_date} />
          </div>
          {data.result?.summary && (
            <div className="mt-3 text-sm">
              <strong>Min:</strong> {data.result.summary.min}°
              <span className="mx-2">|</span>
              <strong>Avg:</strong> {data.result.summary.avg}°
              <span className="mx-2">|</span>
              <strong>Max:</strong> {data.result.summary.max}°
              <span className="mx-2">|</span>
              <span className="text-gray-500">{data.result.summary.count} day(s)</span>
            </div>
          )}

          <div className="mt-5 border border-gray-100 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="p-2 text-left">Date</th>
                  <th className="p-2 text-left">High</th>
                  <th className="p-2 text-left">Avg</th>
                  <th className="p-2 text-left">Low</th>
                  <th className="p-2 text-left">Weather</th>
                </tr>
              </thead>
              <tbody>
                {(data.result?.series ?? []).map((d) => (
                  <tr key={d.date} className="odd:bg-white even:bg-gray-50">
                    <td className="p-2">{d.date}</td>
                    <td className="p-2">{d.hi}°</td>
                    <td className="p-2">{d.avg}°</td>
                    <td className="p-2">{d.lo}°</td>
                    <td className="p-2 flex items-center gap-2 capitalize">
                      <img src={`https://openweathermap.org/img/wn/${d.icon}.png`} alt="" className="h-5 w-5" />
                      {d.desc}
                    </td>
                  </tr>
                ))}
                {!data.result?.series?.length && (
                  <tr><td className="p-3 text-sm text-gray-500" colSpan={5}>No data</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  );
}
