import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "About" };

export default function AboutPage() {
  return (
    <>
      <section className="relative isolate overflow-hidden border-b hairline">
        <div className="mx-auto max-w-3xl px-4 pb-6 pt-10 sm:px-6">
          <p className="label">About</p>
          <h1 className="mt-2 text-4xl font-semibold sm:text-5xl">
            About Pagdandi{" "}
            <span lang="hi" className="text-3xl font-normal text-ink-muted">
              पगडंडी
            </span>
          </h1>
          <p className="mt-3 text-lg text-ink-muted">
            Pagdandi means &ldquo;footpath&rdquo;. It&apos;s an open database of Indian treks, built so a group of friends
            can pick one they can actually do, get ready for it, and then leave the phone in a pocket.
          </p>
        </div>
      </section>

      <div className="mx-auto grid max-w-3xl gap-10 px-4 py-8 sm:px-6">
        <Section id="how" title="How it works">
          <ol className="list-decimal space-y-2 pl-5">
            <li>
              Every trek is a YAML file in our repository, and every number in it is tied to an open source: Wikipedia,
              Wikivoyage, OpenStreetMap, UNESCO or a government page. If we couldn&apos;t source a fact, the site says
              &ldquo;not known yet&rdquo;. We never guess an altitude.
            </li>
            <li>
              Search understands meaning as well as names. It combines Postgres full-text search with EmbeddingGemma
              vectors (pgvector).
            </li>
            <li>
              The trek guide on <Link href="/ask">Ask</Link> is Gemma, an open-weight model we run ourselves, driven by
              Mastra. It can only read our database. It picks treks, and the cards you see are built from the database,
              not from what the model writes. Plain code checks every altitude, distance, day count and cost in its
              answer, and replaces anything that doesn&apos;t match with &ldquo;see the card&rdquo;.
            </li>
            <li>
              Every morning a job checks the forecast (Open-Meteo) and the news (via SerpApi) for treks people are
              heading to. Gemma summarises the news into at most three lines, each with its link.
            </li>
            <li>Each trek has a short audio introduction and a printable one-page plan to take on the trail.</li>
          </ol>
        </Section>

        <Section id="open" title="Why it's open">
          <p>
            The model runs on our own server, so no model company sees what your group is planning, and each chat costs
            us nothing extra. The data is CC BY-SA, so anyone can correct a trek or add one by pull request. Some parts
            are hosted services, and we say so: SerpApi for news, ElevenLabs for the recorded audio, Resend for email,
            Open-Meteo for forecasts.
          </p>
        </Section>

        <Section id="privacy" title="Privacy">
          <ul className="list-disc space-y-1 pl-5">
            <li>Chats are not stored, and are never written to logs.</li>
            <li>
              Daily emails only go to the site admin until we have a domain. If you sign up with any other address, we
              show a preview message and store nothing.
            </li>
            <li>
              For the admin&apos;s subscription we store the email address, the trek and the travel date, and delete them
              the day after travel. Confirmation and unsubscribe links use random tokens stored only as hashes.
            </li>
            <li>No analytics, no ads, no third-party scripts, and fonts are served from this site.</li>
          </ul>
        </Section>

        <Section id="altitude" title="Altitude and safety">
          <p>
            Several treks here go above 3,500 m, where altitude sickness becomes more likely. Climb gradually, drink
            water, and turn back if a headache, nausea or breathlessness gets worse. Read the official advice from the
            state tourism or forest department before you go. Nothing on this site is medical advice, and nothing here
            replaces a licensed local guide.
          </p>
        </Section>

        <Section id="sources" title="Data sources and licences">
          <ul className="list-disc space-y-1 pl-5">
            <li>
              Trek data: our own words, under <a href="https://creativecommons.org/licenses/by-sa/4.0/">CC BY-SA 4.0</a>
              , with each trek&apos;s sources listed on its page.
            </li>
            <li>
              Coordinates and some altitudes: © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap
              contributors</a>, ODbL.
            </li>
            <li>
              Forecasts: <a href="https://open-meteo.com/">Weather data by Open-Meteo.com</a>, CC BY 4.0.
            </li>
            <li>News: Google News results found through SerpApi; each item links to its publisher.</li>
            <li>Audio introductions: voiced with ElevenLabs (elevenlabs.io) from scripts drafted by Gemma.</li>
            <li>
              Code: MIT. Icons and logo: <a href="https://lucide.dev">Lucide</a>, ISC.
            </li>
          </ul>
        </Section>

        <Section id="terms" title="Model terms">
          <p>
            The trek guide uses Gemma 4, released under the{" "}
            <a href="https://ai.google.dev/gemma/apache_2">Apache 2.0 licence</a>. Search uses EmbeddingGemma, provided
            under and subject to the <a href="https://ai.google.dev/gemma/terms">Gemma Terms of Use</a>. By using this
            site you agree not to use it for anything listed in the{" "}
            <a href="https://ai.google.dev/gemma/prohibited_use_policy">Gemma Prohibited Use Policy</a>.
          </p>
        </Section>

        <Section id="credits" title="Credits">
          <p>
            Built for the DEV Hacktoberfest Open-Source AI Challenge (Week 1: Touch Grass). Typefaces: Eczar and Anek Devanagari (SIL Open Font License). Found a mistake?{" "}
            <a href="https://github.com/prateek11rai/pagdandi">Open an issue or a pull request</a>.
          </p>
        </Section>
      </div>
    </>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`}>
      <h2 id={`${id}-h`} className="mb-3 border-b hairline pb-1 text-2xl font-semibold">
        {title}
      </h2>
      {children}
    </section>
  );
}
