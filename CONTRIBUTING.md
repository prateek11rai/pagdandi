# Contributing to Pagdandi

Thanks for helping. The most useful contribution is a trek: a new one, or a fix to one we have.

## Add or fix a trek

Each trek is one file, `data/treks/<slug>.yaml`. The data is CC BY-SA 4.0, so anything you add is shared under the same licence.

1. Copy an existing trek with a similar shape (a day hike, or a multi-day trek) and rename it to `<slug>.yaml`. The slug is lowercase words joined by hyphens, and it must match the file name.
2. Fill in what you can **source**. For every fact, add the page to `sources`, and name the field it backs in that source's `supports` list.
   - Use open sources only: Wikipedia, Wikivoyage, OpenStreetMap, UNESCO, and official government pages (state tourism, forest departments, districts).
   - **Don't use trekking companies or tour operators**, not even to check a number. Their pages are written to sell treks, and copying them is a licence problem.
   - Write in your own words. Don't paste sentences from a source.
   - **If you can't source a fact, write `null`.** The site shows it as "not known yet". Never guess an altitude.
   - If sources disagree, pick the more authoritative one (official, then Wikipedia, then Wikivoyage, then OSM) and leave a comment: `# conflict: A says X, B says Y`.
   - If the only source for a fact is weak (it reads like operator copy, it's an uncited list, or its dates are old), keep the fact, add `# weak source: <why>` next to it, and add an entry to `weak_sources` with a one-sentence note for readers:

     ```yaml
     weak_sources:
       - field: distance_km     # a name from `supports`, e.g. season_months or itinerary.day2
         note: Only Wikivoyage gives this figure, in a passage that reads like trek-operator copy.
     ```

     If a better source disagrees with the weak one, write `null` instead and record both in a comment.
3. Two fields are ours and need no source:
   - `difficulty` uses a fixed rubric:
     - `easy` up to 3,000 m with no technical sections;
     - `moderate` up to 4,000 m, or multi-day with steep climbs;
     - `difficult` above 4,000 m, high passes, glacier or scree.
   - `budget_inr` is a rough per-person estimate for the trek itself, from the railhead or airport. Its `basis` must start with "Pagdandi rough estimate:".
4. Write `audio_script` by hand, from the sourced fields, in at most 85 words (the validator stops at 90). Every number in it must appear in the file's own data, and it must name no fact that isn't in the file. Leave out anything listed in `weak_sources`.
5. Check your file:

   ```sh
   pnpm treks:validate
   ```

   The validator checks types and ranges, that every non-null fact has a source naming it, that each `weak_sources` entry points at a fact that has a value, that the itinerary days are numbered 1..n, and that no camp is higher than the highest point.

6. Open a pull request. CI runs the same validation, and a maintainer reviews the sources.

## Code changes

- Node 24 and pnpm 11 (`corepack enable` picks up the pinned version).
- `pnpm test` runs the unit tests and needs no services. `pnpm dev:up`, then `pnpm test:integration`, runs against local Postgres and Ollama.
- Dependencies: exact versions, and only releases public for at least 7 days (`pnpm-workspace.yaml` enforces this). Please explain any new dependency in the pull request.
- Keep the model's job small. It picks treks and writes short prose; facts come from the database, and numbers in its prose are checked by code.

## Audio intros

Each trek's intro is an MP3 in `public/audio/`, generated with ElevenLabs from the `audio_script` in its YAML file and committed, so the site serves it and it plays offline once downloaded. Only real audio is committed: never a placeholder or a test file. A trek without one shows "not recorded yet".

`public/audio/manifest.json` records what each file was made from: the voice's name (never its ID), the model and the format, and for each trek the script's SHA-256, its length and when it was made.

To add or change an intro, put `ELEVENLABS_API_KEY` and `ELEVENLABS_VOICE_ID` in `.env`. On ElevenLabs' free plan, the voice must be a premade one from the **Default** tab under Voices: the API refuses every Voice Library voice with HTTP 402. The free plan also has no commercial licence, and anything published with its audio must carry "elevenlabs.io" or "11.ai" in its title. Then:

1. Edit `audio_script` in the trek's YAML.
2. Run `pnpm audio --estimate` to see what would be regenerated: each trek whose MP3 is missing or whose script changed, with the reason, the characters (credits) and the expected size. Unchanged treks are skipped. It doesn't call ElevenLabs.
3. Run `pnpm audio`. `--only kedarkantha,triund` narrows the run, and `--force` remakes intros even if unchanged.
4. Listen, then commit the MP3 and the manifest together.

Files are mono MP3 at 64 kbps (about 0.5 MB a minute), and the script stops if `public/audio/` passes 30 MB. If the credits run out, it stops at the first failure, keeps what finished, and lists the rest. A trek goes into the manifest only after its MP3 is saved. The manifest names one voice for every intro, so to change the voice, remake them all with `--force`.

## Repository map

| Path | What's there |
|---|---|
| `src/app/` | Pages (New plan, Treks, trek page, Daily updates, About and data) and API routes (chat, subscribe, confirm, unsubscribe, health). |
| `src/mastra/` | The trek-guide agent, its model (Gemma via Ollama) and its tools. |
| `src/lib/` | Env validation, database, search, fact-check, conditions (Open-Meteo, SerpApi, summaries), subscriptions, email (the HTML and text template, SMTP), audio generation, budget caps. |
| `src/jobs/` | The daily digest (the entry point you run by hand, and its testable core). |
| `src/components/` | The app shell (sidebar and tab bar), the New plan chat and composer, the trek table and card, the audio player, the altitude chart, and UI primitives. |
| `data/treks/` | One YAML file per trek (CC BY-SA 4.0), including its audio script. |
| `public/audio/` | The audio intros, and the manifest of what each was made from. |
| `db/migrations/` | Plain SQL migrations. |
| `scripts/` | Database migrations, the trek data pipeline, search eval, a one-off news check, the email preview, audio, the topo pattern, the dev stack, DevRelay setup. |
| `tests/` | `unit/` (no services) and `integration/` (needs `pnpm dev:up`), including the red-team suite. |
| `docs/` | Build log, runbook, DevRelay setup, post draft, the screenshots the README and the post use (`docs/img/`), and the banner and cover sources (`docs/design/`). |
