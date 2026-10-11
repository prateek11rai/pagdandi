import type { Metadata } from "next";

export const metadata: Metadata = { title: "About and data" };

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-[1120px] px-4 pb-16 pt-8 shell:px-12 shell:pt-11">
      <h1 className="text-[32px]">About and data</h1>
      <div className="@container">
        <div className="grid gap-x-7 @min-[50rem]:grid-cols-2">
          <div className="min-w-0">
            <Section title="What Pagdandi is">
              <p>
                An open database of Indian treks, with a guide you can ask. Tell it about your group and it recommends treks
                it can back with sources. Then it gets out of the way: an audio intro for the drive, a one-page plan for
                the trail. Pagdandi (<span lang="hi">पगडंडी</span>) means &ldquo;footpath&rdquo;.
              </p>
            </Section>
            <Section title="How the guide works">
              <p>
                The guide is Gemma 4, an open-weight model running on the laptop that serves this site, driven by Mastra.
                There&apos;s no server and no per-chat bill, and anyone can host their own copy. It searches this database
                (Postgres full-text search and EmbeddingGemma vectors) and only recommends treks from it. Every number on a
                card comes from the database, and plain code checks the numbers in its sentences before you see them:
                anything that doesn&apos;t match becomes &ldquo;see the card&rdquo;. Chats aren&apos;t stored.
              </p>
            </Section>
            <Section title="Privacy">
              <ul className="list-disc space-y-1 pl-5">
                <li>Chats go to the model on the machine running the site, not to a model company. They aren&apos;t stored there or in your browser, and are never written to logs.</li>
                <li>
                  Daily emails only go to the site admin until we have a domain. If you sign up with any other address, we
                  show a preview message and store nothing.
                </li>
                <li>
                  For the admin&apos;s subscription we store the email address, the trek and the travel date, and delete
                  them the day after travel. Confirmation and unsubscribe links use random tokens stored only as hashes.
                </li>
                <li>No analytics, no ads and no third-party scripts. Fonts are served from this site.</li>
                <li>
                  Hosted services see some data: SerpApi gets trek names, ElevenLabs the audio scripts, Open-Meteo trek
                  coordinates, and Tiger Data, if it hosts the database, the guide&apos;s search queries and the
                  admin&apos;s subscription. Emails go out over SMTP from the admin&apos;s own mailbox, to the admin.
                </li>
              </ul>
            </Section>
          </div>

          <div className="min-w-0">
            <Section title="Where the data comes from">
              <ul className="list-disc space-y-1 pl-5">
                <li>
                  20 treks, one file each, written from Wikipedia, Wikivoyage, OpenStreetMap, UNESCO and government pages.
                  No trekking companies.
                </li>
                <li>
                  Every fact names its source. If we couldn&apos;t find one, the fact is blank and the page says &ldquo;not
                  known yet&rdquo;. A fact we could only source weakly is marked, and its trek page says why.
                </li>
                <li>
                  Trek text is <a href="https://creativecommons.org/licenses/by-sa/4.0/">CC BY-SA 4.0</a>. Map data ©{" "}
                  <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>. Forecasts from{" "}
                  <a href="https://open-meteo.com/">Open-Meteo</a>. Anyone can fix a trek or add one{" "}
                  <a href="https://github.com/prateek11rai/pagdandi">on GitHub</a>.
                </li>
              </ul>
            </Section>
            <Section title="Not advice">
              <p>
                Pagdandi is not medical advice and not a substitute for a licensed local guide. Several treks here go above
                3,500 m, where altitude sickness becomes more likely. Read the official advisories before you go.
              </p>
            </Section>
            <Section title="Credits">
              <p>
                Code is MIT. Forecasts: <a href="https://open-meteo.com/">Weather data by Open-Meteo.com</a>, CC BY 4.0.
                News found through SerpApi, each item linked to its publisher. Audio intros voiced with ElevenLabs
                (elevenlabs.io). Fonts: Eczar and Anek Devanagari (SIL Open Font License). Icons and logo:{" "}
                <a href="https://lucide.dev">Lucide</a> (ISC). Built for the DEV Hacktoberfest Open-Source AI Challenge,
                Week 1: Touch Grass.
              </p>
            </Section>
            <Section title="Model terms">
              <p>
                The guide uses Gemma 4, released under the <a href="https://ai.google.dev/gemma/apache_2">Apache 2.0
                licence</a>. Search uses EmbeddingGemma, provided under and subject to the{" "}
                <a href="https://ai.google.dev/gemma/terms">Gemma Terms of Use</a>. By using this site you agree not to
                use it for anything listed in the{" "}
                <a href="https://ai.google.dev/gemma/prohibited_use_policy">Gemma Prohibited Use Policy</a>.
              </p>
            </Section>
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="max-w-[560px]">
      <h2 className="mb-2.5 mt-7 border-b border-rule pb-1 text-2xl">{title}</h2>
      {children}
    </section>
  );
}
