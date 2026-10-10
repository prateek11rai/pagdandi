<p align="center">
  <img src="public/brand/logo.svg" alt="" width="64" height="64">
</p>

<h1 align="center">Pagdandi</h1>

<p align="center"><strong>पगडंडी · India's open trek database.</strong> Pick a trek your group can actually do, get the conditions every morning until you leave, then put the phone away.</p>

<p align="center">
  <a href="LICENSE"><img alt="License: MIT" src="https://img.shields.io/badge/code-MIT-3F6B4F"></a>
  <a href="data/LICENSE.md"><img alt="Data: CC BY-SA 4.0" src="https://img.shields.io/badge/data-CC%20BY--SA%204.0-3F6B4F"></a>
  <img alt="Node 24" src="https://img.shields.io/badge/node-24-1F2A24">
  <img alt="pnpm 11" src="https://img.shields.io/badge/pnpm-11-1F2A24">
</p>

Pagdandi ("footpath") is a website for friend groups who keep saying "this time we're definitely going on a trek". It has 20 well-known Indian treks, each one sourced fact by fact, with a meaning-aware search and a trek guide that runs on [Gemma](https://ai.google.dev/gemma), an open-weight model we host ourselves. You can listen to an audio intro for each trek and get daily email updates until the trip. Everything about the data is open: the treks are YAML files you can fix or extend by pull request.

## What it is

- **Treks** (`/`): search by what you want ("snow trek for beginners in December"), filter by region, month, days, difficulty and budget, and browse guidebook-style cards.
- **Trek pages** (`/treks/<slug>`): the facts, an audio intro, an altitude-by-day figure, the day-by-day plan, getting there, permits, last mobile signal, when to go, today's conditions, and sources. Add **Take it on the trail** for the MP3 and a one-page printable plan.
- **Ask** (`/ask`): tell the guide about your group, and it recommends treks from the database.
- **Updates** (`/updates`): a short email at 7:00 IST until your travel date, with the forecast, news since yesterday, and one thing to do outside today.

How it works:

1. Every trek is a YAML file validated by a zod schema. Any fact that isn't `null` must be backed by a source that names it.
2. Treks are loaded into Postgres. Search fuses full-text search (`tsvector`) with EmbeddingGemma vectors (pgvector) using reciprocal rank fusion.
3. The guide is a [Mastra](https://mastra.ai) agent on Gemma 4, with read-only tools. It returns recommendations as tool calls, and the cards are built from the database.
4. Plain code checks every altitude, day count, distance and cost in the guide's prose against the database. A number that doesn't match becomes "(see the card)".
5. A daily cron job fetches each followed trek's conditions once: an Open-Meteo forecast, and news via SerpApi under a hard budget cap. Gemma summarises the news, and the job emails each subscriber.

> [!NOTE]
> The guide is not medical advice and not a substitute for a licensed local guide. Treks above 3,500 m always come with an altitude-safety note.

## Built for

The [DEV Hacktoberfest Open-Source AI Challenge, Week 1: Touch Grass](https://dev.to/challenges/hacktoberfest-week1-2026-10-05). Submission post: *link added when published*.

| Category | How Pagdandi uses it |
|---|---|
| Gemma | Gemma 4 runs the trek guide, summarises news and drafts the audio scripts. EmbeddingGemma powers search. Both are self-hosted through Ollama. |
| Render | One Blueprint: the Next.js web service, a private Ollama service (Render as the AI runtime) and the daily cron job. |
| Tiger Data | Postgres with pgvector holds the treks, the hybrid search index, cached conditions, subscriptions and API budgets. |
| SerpApi | Google News results for each trek (closures, landslides, snowfall, permits), behind per-day and per-month caps. |
| ElevenLabs | Voices a short audio introduction for every trek, generated once and served as an MP3. |
| Mastra | The agent framework behind the guide: the agent, its tools and the streaming chat. |

## Try it

*The Render URL goes here once deployed.*

## Run it locally

You need macOS with Homebrew (or a matching Linux setup), Node 24 and pnpm 11.

```sh
brew install node@24 pnpm ollama postgresql@17 pgvector
pnpm install
cp .env.example .env        # then fill in the variables below
pnpm dev:up                  # starts Postgres (127.0.0.1:54329) and Ollama if they aren't running
ollama pull gemma4:e4b
ollama pull embeddinggemma:300m
pnpm treks:load && pnpm treks:embed
pnpm dev                     # http://localhost:3000
```

`pnpm dev:down` stops only what `pnpm dev:up` started.

| Variable | Needed for | Where the value comes from |
|---|---|---|
| `DATABASE_URL` | everything | Locally, what `pnpm dev:up` prints. In production, the Tiger Data service URL (with `sslmode=require`). |
| `ADMIN_EMAIL` | web, digest | The only address daily emails reach until there's a domain. |
| `OLLAMA_BASE_URL` | chat, search, digest | Defaults to `http://127.0.0.1:11434`. On Render, `OLLAMA_HOSTPORT` is set by the Blueprint. |
| `CHAT_MODEL`, `EMBED_MODEL` | chat, search | Default `gemma4:e4b` and `embeddinggemma:300m`. |
| `SITE_URL` | email links | Defaults to `http://localhost:3000`. |
| `EMAIL_MODE`, `RESEND_API_KEY` | email | `dry-run` (default) writes emails to `.data/outbox/`. `resend` sends them, using a key from resend.com. |
| `NEWS_MODE`, `SERPAPI_API_KEY` | digest | `fixtures` (default) uses recorded samples, labelled as such. `serpapi` makes live searches, using the key from your SerpApi dashboard. |
| `SERPAPI_DAILY_CAP`, `SERPAPI_MONTHLY_CAP` | digest | Hard caps (25 and 200); the free plan allows 250 a month. |
| `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID` | `pnpm audio` only | ElevenLabs settings and voice library. |

> [!WARNING]
> Never commit `.env`. `.gitignore` covers it, and the repo's `.npmrc` only pins the public npm registry.

Other commands:

| Command | What it does |
|---|---|
| `pnpm treks:validate` | Validate every trek file against the schema and the sourcing rule. |
| `pnpm search:eval` | Run the five benchmark searches. |
| `pnpm digest --dry-run` | Run the daily job and print the emails instead of sending them. Add `--no-sweep` to skip the Sunday refresh of every trek. |
| `pnpm audio:draft` | Have Gemma draft audio scripts into the YAML. |
| `pnpm audio --estimate` / `pnpm audio` | Count ElevenLabs characters, then generate the MP3s. |

## Repository map

| Path | What's there |
|---|---|
| `src/app/` | Pages (Treks, trek page, Ask, Updates, About) and API routes (chat, subscribe, confirm, unsubscribe, health). |
| `src/mastra/` | The trek-guide agent, its model (Gemma via Ollama) and its tools. |
| `src/lib/` | Env validation, database, search, fact-check, conditions (Open-Meteo, SerpApi, summaries), subscriptions, email, budget caps. |
| `src/jobs/` | The daily digest (the cron entry point and its testable core). |
| `src/components/` | The trek card, altitude chart, audio player, chat, and UI primitives. |
| `data/treks/` | One YAML file per trek (CC BY-SA 4.0). |
| `db/migrations/` | Plain SQL migrations. |
| `scripts/` | Data pipeline, audio, dev stack, DevRelay setup. |
| `ops/ollama/` | The Ollama image for Render's private service. |
| `tests/` | `unit/` (no services) and `integration/` (needs `pnpm dev:up`). |
| `docs/` | Build log, runbook for deploying, DevRelay setup, post draft, screenshots. |

## Data

- **Sources:** Wikipedia, Wikivoyage, OpenStreetMap, UNESCO and official Indian government pages. Trekking companies are never used. Each trek lists its sources, and each source names the fields it backs.
- **Unknown means `null`:** if a fact can't be sourced, the site says "not known yet". Difficulty and budget are our own estimates, made with fixed rules, and the site labels them that way.
- **Review:** an AI-assisted fact-check pass re-checked every number against its source (see [the build log](docs/BUILD_LOG.md)), and a maintainer reviews a sample.
- **Adding a trek:** see [CONTRIBUTING.md](CONTRIBUTING.md). CI runs `pnpm treks:validate` on every pull request.

> [!NOTE]
> Some well-known facts are missing on purpose. For example, no open source names Kedarkantha's winter months, so a December search won't find it until someone adds a source.

## Testing

```sh
pnpm test               # unit: schema, search ranking, prose fact-check, cards, subscriptions, digest, budget caps, lockfile hosts, env
pnpm dev:up
pnpm test:integration   # real Postgres + Ollama: loading, hybrid search, a real Gemma recommendation, the digest dry run
```

If the local stack is down, integration tests fail with "run `pnpm dev:up` first"; they never skip. CI runs both suites. The integration job uses Postgres with pgvector and Ollama with `gemma4:e2b`.

## Privacy

- Chats are not stored and never logged. The browser keeps the conversation; the server only sees the recent turns, capped in length.
- The model runs on our own server, so no model company sees what anyone is planning.
- Daily emails reach only the admin until there's a domain. Any other address gets a preview message, and nothing is stored.
- For the admin's subscription, we store the email, the trek and the travel date, and delete them the day after travel. Tokens are random and stored only as hashes.
- No analytics, no ads, and no third-party scripts. Fonts are self-hosted at build time.
- Hosted services do get some data: SerpApi gets trek names, ElevenLabs gets the audio scripts, Resend gets the admin's emails, and Open-Meteo gets trek coordinates.

## How it's built

**Gemma.** Gemma 4 (`gemma4:e4b`, or `e2b` on smaller CPUs) runs through Ollama, with thinking turned off: with thinking on, it spent its whole token budget reasoning. It powers the trek guide, the news summaries and the first drafts of the audio scripts. EmbeddingGemma (300M, 768 dimensions) embeds treks and queries with its asymmetric prompts. No model vendor is involved, and a chat costs nothing beyond the server.

**Render.** `render.yaml` defines three services in one region:
- `pagdandi-web`, the Next.js app, with a health check and a pre-deploy step that migrates the database and loads the treks;
- `pagdandi-ollama`, a private Docker service on Render's private network, with models on a persistent disk;
- `pagdandi-daily`, the cron job at 07:00 IST.

**Tiger Data.** One Postgres database holds everything:
- the treks, with a generated `tsvector` and a pgvector column, behind hybrid search fused with RRF;
- conditions history;
- subscriptions, with token hashes;
- the API budget counters, which use atomic `insert … on conflict … where used < cap` updates.

**SerpApi.** It finds Google News results for each trek, and only from the daily job, never from the chat. Each search first reserves budget against per-day and per-month caps; a full budget is an error the job reports. Gemma turns the results into at most three lines, each with its own link and date.

**ElevenLabs.** `scripts/make-audio.ts` voices each trek's script once into `public/audio/<slug>.en.mp3`. The site serves the files itself, so they also work offline after download.

**Mastra.** The guide is a Mastra agent with four tools: `searchTreks`, `getTrek`, `getConditions` and `recommendTreks`. `@mastra/ai-sdk` streams it to the AI SDK's `useChat`. The route builds the agent's options itself, so a browser can't change its instructions or limits.

## License and attribution

- Code: [MIT](LICENSE).
- Trek data: [CC BY-SA 4.0](data/LICENSE.md).
- Map data: © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright), ODbL.
- Forecasts: [Weather data by Open-Meteo.com](https://open-meteo.com/), CC BY 4.0.
- Gemma 4: [Apache 2.0](https://ai.google.dev/gemma/apache_2). EmbeddingGemma is provided under and subject to the [Gemma Terms of Use](https://ai.google.dev/gemma/terms), and the site's terms carry the [Prohibited Use Policy](https://ai.google.dev/gemma/prohibited_use_policy).
- Logo: the Lucide "footprints" icon, ISC ([notice](public/brand/logo-LICENSE.txt)).
- Audio: voiced with [ElevenLabs](https://elevenlabs.io), under its terms for the plan used.
- Fonts: Fraunces, Mukta and Tiro Devanagari Hindi (SIL Open Font License).

## After the deadline

The challenge closed on Mon 12 Oct 2026 at 06:59 UTC. Commits made after that are listed here, with dates.

*None yet.*
