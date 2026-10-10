import { getLatestConditions } from "@/lib/conditions/store";
import type { PlaceForecast } from "@/lib/conditions/types";
import { weatherLabel } from "@/lib/conditions/weather-codes";
import type { Trek } from "@/lib/trek-schema";

const IST = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" });
const DAY = new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "Asia/Kolkata" });

export async function ConditionsPanel({ trek }: { trek: Trek }) {
  const c = await getLatestConditions(trek.slug);
  if (!c.forecast && !c.news) {
    return (
      <p className="text-ink-muted">
        We check the forecast and the news each morning for treks people are heading to, and every trek once a week.
        This one hasn&apos;t been checked yet.
      </p>
    );
  }
  return (
    <div className="grid gap-6">
      {c.forecast && (
        <div>
          <p className="label">Forecast · checked {IST.format(c.forecast.fetchedAt)} IST</p>
          <div className="mt-2 grid gap-4 sm:grid-cols-2">
            {c.forecast.payload.places.map((p) => (
              <PlaceTable key={p.place} p={p} />
            ))}
          </div>
          <p className="mt-2 text-sm text-ink-muted">
            The high-point forecast uses the road head&apos;s location, corrected to the high point&apos;s altitude: treat
            it as an estimate. <a href="https://open-meteo.com/">Weather data by Open-Meteo.com</a>
          </p>
        </div>
      )}
      {c.news && (
        <div>
          <p className="label">News · checked {IST.format(c.news.fetchedAt)} IST</p>
          {c.news.payload.fixture && (
            <p className="mt-1 text-sm font-semibold text-clay-ink">SAMPLE DATA for development: these are not real news reports.</p>
          )}
          {c.news.summary && c.news.summary.bullets.length > 0 ? (
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {c.news.summary.bullets.map((b) => (
                <li key={b.url}>
                  {b.text}{" "}
                  <a href={b.url} rel="noopener noreferrer nofollow">
                    source{b.date ? `, ${DAY.format(new Date(b.date))}` : ""}
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2">No new reports found.</p>
          )}
        </div>
      )}
    </div>
  );
}

function PlaceTable({ p }: { p: PlaceForecast }) {
  return (
    <table className="w-full text-sm">
      <caption className="text-left font-semibold">
        {p.place === "road_head" ? "Road head" : "High point"}: {p.name}
        {p.elevationM !== null ? ` (${p.elevationM.toLocaleString("en-IN")} m)` : ""}
      </caption>
      <thead>
        <tr className="label text-left">
          <th className="py-1 font-semibold">Day</th>
          <th className="font-semibold">Sky</th>
          <th className="text-right font-semibold">°C</th>
          <th className="text-right font-semibold">Rain/snow</th>
        </tr>
      </thead>
      <tbody>
        {p.days.slice(0, 3).map((d) => (
          <tr key={d.date} className="border-t hairline">
            <td className="py-1">{DAY.format(new Date(d.date))}</td>
            <td>{weatherLabel(d.code)}</td>
            <td className="text-right tabular-nums">
              {d.tminC !== null && d.tmaxC !== null ? `${Math.round(d.tminC)}–${Math.round(d.tmaxC)}` : "–"}
            </td>
            <td className="text-right tabular-nums">
              {d.snowCm ? `${d.snowCm} cm snow` : d.precipMm !== null ? `${d.precipMm} mm` : "–"}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
