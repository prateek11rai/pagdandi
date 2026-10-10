import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="no-print mt-16 border-t hairline">
      <div className="mx-auto grid max-w-6xl gap-2 px-4 py-6 text-sm text-ink-muted sm:px-6">
        <p>
          Trek data is <a href="https://creativecommons.org/licenses/by-sa/4.0/">CC BY-SA 4.0</a>. Code is MIT. Map
          data © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>. Forecasts by{" "}
          <a href="https://open-meteo.com/">Open-Meteo</a>.
        </p>
        <p>
          The trek guide runs on Gemma, an open-weight model we host ourselves. Not medical advice, and not a substitute
          for a licensed local guide. <Link href="/about">How it works</Link>
        </p>
      </div>
    </footer>
  );
}
