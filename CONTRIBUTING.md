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
   - If the only source for a fact reads like operator copy, keep it but add `# weak source: <why>`.
3. Two fields are ours and need no source:
   - `difficulty` uses a fixed rubric:
     - `easy` up to 3,000 m with no technical sections;
     - `moderate` up to 4,000 m, or multi-day with steep climbs;
     - `difficult` above 4,000 m, high passes, glacier or scree.
   - `budget_inr` is a rough per-person estimate for the trek itself, from the railhead or airport. Its `basis` must start with "Pagdandi rough estimate:".
4. Leave `audio_script` as `null`. We draft it with Gemma and review it.
5. Check your file:

   ```sh
   pnpm treks:validate
   ```

   The validator checks types and ranges, that every non-null fact has a source naming it, that the itinerary days are numbered 1..n, and that no camp is higher than the highest point.

6. Open a pull request. CI runs the same validation, and a maintainer reviews the sources.

## Code changes

- Node 24 and pnpm 11 (`corepack enable` picks up the pinned version).
- `pnpm test` runs the unit tests and needs no services. `pnpm dev:up`, then `pnpm test:integration`, runs against local Postgres and Ollama.
- Dependencies: exact versions, and only releases public for at least 7 days (`pnpm-workspace.yaml` enforces this). Please explain any new dependency in the pull request.
- Keep the model's job small. It picks treks and writes short prose; facts come from the database, and numbers in its prose are checked by code.
