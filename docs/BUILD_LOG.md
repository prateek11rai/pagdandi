# Build log

Decisions, dead ends, surprises and real numbers, in the order they happened. Times are IST.

## Sunday 11 October

### Challenge check
- Read the Week 1 challenge live through DevRelay. The window closes Mon 12 Oct 06:59 UTC (12:29 IST). It requires the template and `#hf26challenge`, allows one entry, and lets you win one category at most.
- The rule that commits made after the deadline must be listed in the README comes from DEV's standard challenge FAQ, not the Week 1 rules page. We follow it anyway.

### Decisions
- **No chat memory on the server.** Mastra Memory persists threads to storage, which would mean storing chat transcripts. Instead, the browser sends the conversation so far with each message. The agent remembers the conversation while it lasts, and nothing is stored.
- **One search document per trek.** With about 20 treks, chunking adds nothing. Each trek has a `title` (name, state, region; weight A) and a `body` (area, highlights, itinerary places, season; weight B) in a generated `tsvector`, plus a 768-dimension EmbeddingGemma vector.
- **Derived fields are labelled as ours.** Difficulty follows a fixed rubric based on the highest point and terrain. The budget band is a "Pagdandi rough estimate" for the trek itself, from the railhead or airport. These are the only unsourced fields, and the site says so.
- **High-point forecast:** we have coordinates for the road head, but not reliable ones for every high point. We ask Open-Meteo for the road head's coordinates with `elevation` set to the high point's altitude, which corrects the temperatures for height. The page labels this as an estimate.
- **Local Postgres on 127.0.0.1:54329, TCP only, data in `.data/pg`,** so it can't collide with any other Postgres on the machine.
- **TypeScript 6.0.3, not 7.0.** typescript-eslint requires `typescript <6.1.0`.
- **ESLint 10 without `eslint-config-next`.** We first took ESLint 9.39.5, because `eslint-config-next` pulls in react, import and jsx-a11y plugins that cap ESLint at 9. But ESLint 9 is end-of-life, and its deprecation notice put an `eslint.org` URL in the lockfile, which the leak check rejected. So we use ESLint 10 with typescript-eslint, `@next/eslint-plugin-next` and react-hooks, and lose the jsx-a11y rules.
- **Both dependency build scripts are denied** (`allowBuilds: false`). esbuild and unrs-resolver work from their prebuilt optional packages; `tsx`, `vite` and the import resolver were checked.

### Surprises
- The DevRelay manifest is at 0.1.20, and the three maintenance bullets are no longer in its agent rules, so "drop the last three bullets" would have removed real rules. `pnpm devrelay:setup` now drops them by title.

### Trek data: research, then a fact-check pass
- Four research agents, one per region, drafted 20 YAML files from Wikipedia, Wikivoyage, OpenStreetMap, UNESCO and government pages. Trekking companies were off limits even for comparison.
- Four more agents then re-opened every cited source and checked each number. They filled gaps where a source allowed it and flagged weak sources. Every file now has `facts_checked_by: Pagdandi fact-check pass (AI-assisted)`, pending a sample review by a person.
- The validator enforces the rule: a non-null fact must be named in some source's `supports` list. Kheerganga failed this until the checker found sources for its high point.

What the fact-check pass changed (numbers and facts only; about a dozen highlights and permit notes were also reworded because they were too close to the source text):

| Trek | Field | Draft | After check | Why |
|---|---|---|---|---|
| agasthyarkoodam | highest point | 1890 m | 1868 m | UNESCO MAB and Kerala Tourism's own event page say 1868; 1890 was a slip on one tourism page |
| agasthyarkoodam | stage distances | 14 / 12 / 14 km | 20 / 10 / 20 km | the official stages add up to the official 50 km |
| dzukou-valley | highest point | 2452 m | 2438 m | Kohima district page (2,438.4 m) and Wikipedia; the 2452 m came from a contributed guide page |
| dzukou-valley | day 1 distance | 9 km | not known | the source doesn't say which route or whether it is one way |
| kedarkantha | itinerary | 3 days built from OSM trail segments | none | no source lays out the stages |
| har-ki-dun | days | not known | 4 | Hindi Wikipedia's stages (flagged weak: it cites a forum) |
| harishchandragad | days | not known | 2 | Marathi Wikipedia's stages |
| brahmatal | airport | Jolly Grant (DED) | Pantnagar (PGH) | Wikivoyage and Wikipedia |
| brahmatal | last mobile signal | Lohajung | not known | the source says Lohajung has signal, not that it is the last |
| kashmir-great-lakes | camps on days 3 and 4 | not known | 3600 m, 3610 m | Wikipedia's Gadsar and Satsar lake articles |
| hampta-pass | season | none | May–Oct (flagged weak) | Himachal's trek registration portal, 2022 listings |
| chembra-peak | permits | 2020-era group fees | 2026 Forest Department listing: online booking paused, Rs 800 per Indian adult | ecotourism.forest.kerala.gov.in |
| dayara-bugyal | permits | "photo ID" | "proof of address" | what the source actually says |
| kheerganga | highest point | no source (failed validation) | four sources for the name; altitude still not known | Wikivoyage, HP Forest, OSM |

What is still thin:
- Kedarkantha's winter months. It is famous as a December snow trek, but no open source names its season, so it has the national park's Apr–Jun and Sep–Nov. A December search won't find it. That is the cost of "never guess".
- Kheerganga and Nongriat have no sourced altitude.
- Nag Tibba and Brahmatal have no sourced season.
- 28 `# weak source` comments mark facts that rest on Wikivoyage passages that read like operator copy, or on Wikipedia lines that cite operators.

### Search quality: five test queries
`pnpm search:eval` runs these against the 20 treks (local Postgres, EmbeddingGemma 300m). It takes 12–20 ms per query once the model is warm, plus about 100 ms for the first query.

| Query | Top 5 now | First try |
|---|---|---|
| snow trek for beginners in December | dayara-bugyal, goecha-la, sandakphu, chembra-peak, nag-tibba | dayara-bugyal, sandakphu, goecha-la, brahmatal, kumara-parvatha |
| easy one day hike near Mumbai | harishchandragad, chembra-peak, triund, kudremukh, kalsubai | chembra-peak, harishchandragad, triund, nongriat-root-bridges, kalsubai |
| high altitude lakes in Kashmir | kashmir-great-lakes, brahmatal, kedarkantha, hampta-pass, chembra-peak | the same |
| living root bridges in the rain | nongriat-root-bridges, agasthyarkoodam, triund, chembra-peak, valley-of-flowers | nongriat-root-bridges first |
| short trek near Delhi for a long weekend | nag-tibba, harishchandragad, kedarkantha, dzukou-valley, valley-of-flowers | nag-tibba first, then dzukou-valley second |

Dead ends on the way:
- **`websearch_to_tsquery`** ANDs every word, so most natural questions matched nothing. We switched to OR-ing the query's lexemes.
- **OR-ing every lexeme matched 19–20 of 20 treks,** because every document says "trek" and "day". `ts_rank_cd` has no IDF, so common words drowned out rare ones. Now the full-text side drops any query word found in more than half the documents, using `ts_stat`. Tiger's BM25 (`pg_textsearch`) would do this properly, but it isn't available on local Postgres.
- **Textbook RRF (k = 60, 40 candidates per side) let noise win.** With 20 treks, every trek appears somewhere in the vector list, so a trek that also matched a stray word ("near", "long") got a fusion bonus. "Short trek near Delhi" put Dzükou (Nagaland) first. Fusing only each side's top 8, with k = 20, put Nag Tibba first.
- **"Mumbai" wasn't in any document.** The documents now include the sourced road head, railhead and airport names.

### Chat: Gemma 4 e4b on the laptop
- With thinking on, Gemma spent its 300-token budget reasoning and never finished the answer. With `reasoning_effort: "none"` on Ollama's `/v1`, it called the tool and answered in 2.8 s. The open Ollama issue about empty replies after a tool result, with thinking off, did not reproduce on 0.35.1.
- Your group prompt ("5 of us, 2 first-timers, ₹12k each, 4 days in December, from Delhi") takes 15–16 s for the full turn locally: search, recommend, then the answer. A cold model adds about 20 s.
- At first Gemma read "first-timers" as `difficulty: easy`, which ruled out every moderate beginner trek. The tool now takes `maxDifficulty`, and when nothing fits every constraint it returns the closest matches with a note saying so.

### Conditions and daily updates
- **Local end-to-end run:** sign-up from a non-admin address (preview, nothing stored), sign-up as admin, confirmation link, then `pnpm digest --dry-run`, then one-click unsubscribe (POST answers 200; the row is deleted).
- **Real numbers:** today is Sunday (IST), so the run was also the weekly sweep. It covered 20 treks, with two Open-Meteo calls each plus a Gemma news summary where fixture news existed, and took 29 s on the laptop.
- **Surprise:** Gemma's one-line summaries dropped the "SAMPLE:" prefix from the fixture headlines, so recorded sample news read like real reports in the email. Fixture news is now flagged in the payload, and both the email and the trek page say "SAMPLE DATA" above it. A unit test makes sure it stays that way.
- **Unsubscribe tokens:** we store only hashes, so a daily email can't reuse the token from sign-up. Each email gets its own random token (`unsubscribe_tokens`, migration 0002), and any email's link works until the subscription is deleted.
- **SerpApi budget:** the free plan allows 250 searches a month, and we cap at 200 a month and 25 a day. A daily run uses one search per followed trek (today that's one trek: the admin's). The Sunday sweep uses one per trek (20). That comes to roughly 20 × 4.3 + 30 ≈ 120 a month.

### Audio scripts, tests, CI
- **Audio scripts:** Gemma drafted all 20 audio scripts, at 127–158 words and 9–13 s each on the laptop. Every number was checked against that trek's data, and no draft needed a retry. The first version rewrote whole YAML files through the `yaml` library (respacing flow maps and unfolding text). Now only the `audio_script` block changes, about 10 lines per file.
- **ElevenLabs:** all 20 intros come to 17,003 characters (`pnpm audio --estimate`). The free plan's 10,000 a month won't cover them, so it's Starter or the Hacktoberfest credit. The free plan would also require "elevenlabs.io" in each title.
- **Integration suite:** 11 tests against real Postgres and Ollama in 28 s on the laptop: hybrid search, a real Gemma recommendation through the chat route, SQL stores and caps, and the digest dry run.
- **Fresh clone:** in a temporary clone, `pnpm install --frozen-lockfile` used `registry.npmjs.org` only; validation and all 59 unit tests passed.
- **CI:** Actions are pinned by commit SHA, with the same 7-day cooldown (setup-node v7.1.0 was 3 days old, so we use v7.0.0). Images are pinned by digest. Integration runs in CI on `gemma4:e2b`, with the models cached.
- **The Ask page in a real browser:** the group prompt gave one card, Kudremukh in Karnataka, for a group in Delhi. I had told Gemma to keep the group's city out of the search query, which threw away the signal the vector side handles well ("near Delhi" put Nag Tibba first in the eval). Now the query adds "near <city>". Two runs in a row gave Dayara Bugyal (Uttarakhand), Harishchandragad and Kumara Parvatha in 15–18 s, with every number checked. The answer can't include the Uttarakhand winter treks, because no open source gives their winter months.

### Sunday, later: UI fixes, the Delhi group, a data spot-check
- **Altitude figure:** it used to draw a straight line between any two known points, so Kedarkantha (no sourced stages) showed a flat 3-day line at road-head height, and every day hike showed a flat line under its summit. Now a line joins two known points only within a day, and passes through that day's high point. Day hikes go up and back down. Nothing is drawn across an unknown camp, and the figure says "Camp altitude not known…".
- **The Delhi group, properly this time.** "Near Delhi" in the query wasn't enough. Two problems:
  - The search tool applied the group's limits (month, days, difficulty, budget) **after** hybrid search, which now passes only each side's top 8 candidates. Often one trek survived: Sandakphu for Delhi, Nongriat (Meghalaya) for Bengaluru.
  - Distance from the group's city was left to the model's wording.

  Now the limits are SQL filters on both sides of the search. The tool takes a `from` city and re-ranks by relevance plus straight-line distance (each 250 km costs one place), using approximate city coordinates that are never shown.

  Re-test, with the same prompts as before:

  | Prompt | Runs | First card |
  |---|---|---|
  | Delhi group (December, 4 days, ₹12k) | 3 | Dayara Bugyal (Uttarakhand) every time, then Sandakphu; Kudremukh never appears |
  | Mumbai, one-day hike in November | 1 | Kalsubai |
  | Bengaluru, 2 days in January | 1 | Kudremukh |

  Each answer took 14–18 s with no fact-check replacements. An integration test now pins the Delhi and Bengaluru rankings.
- **Spot-check of 5 files against their cited sources** (Valley of Flowers, Triund, Kashmir Great Lakes, Nongriat, Kudremukh):
  - 30 facts checked, all coordinates against OSM. Nothing was wrong.
  - One open question: Valley of Flowers' season is May–Oct from Uttarakhand Tourism, but that page renders with JavaScript and couldn't be re-read, while Wikipedia says "open only during summer from June to October".
  - Softest number: Triund's 22 km. The district page says "11 km from McLeod Ganj", Wikivoyage 6 km each way from Dharamkot, and the forest department 18 km return.

### Review answers applied
- **Valley of Flowers:** season changed to June–October, following Wikipedia ("open only during summer from June to October"). Uttarakhand Tourism's May–October couldn't be re-read because its page renders with JavaScript; a YAML comment says so.
- **Triund:** the 22 km round trip stays (the district page's 11 km from McLeod Ganj, doubled). The conflicts are now in a comment: the forest department's 18 km return, and Wikivoyage's 6 km each way from Dharamkot.
- **Agasthyarkoodam:** the permit text is cut from about 125 words to 77, keeping the facts. The detail (2027 season not listed yet, the portal giving no fee or dates, the dated page's old ban on women) moved to a comment.
- **Kedarkantha's altitude figure:** the first fix still plotted a "Finish" point at Sankri, which only repeated the start. When the stages aren't sourced and a trek ends where it started, the figure shows just the start, the summit and "Camp altitudes not known".
- **A latent bug in the prose fact-check:** an accepted number was recorded as a zero-width span, so it couldn't stop a later pattern from judging the same text again, even though the comment claimed it did. It didn't affect any answer with today's patterns. Every judged span is now kept with an `ok` flag, and a test pins the behaviour. Found while copying the code into the post.
- **`pnpm digest --no-sweep`:** for the one manual test email. Today is Sunday in IST, so without the flag the run would sweep all 20 treks and spend 20 SerpApi searches instead of one.
- **Audio scripts redrafted with varied openings.** At least two of the first drafts began "Are you ready for an adventure", which sounds canned when you play several intros in a row. Now each script's first sentence comes from that trek's own signature highlight, and code rejects drafts that:
  - contain a question;
  - begin with a stock phrase ("Imagine", "Are you ready", "Welcome"…);
  - share their first three content words with another trek;
  - run under 120 words, or drop the closing line;
  - fail the number check. Bare numbers ("600 kinds") must appear in the trek's data; numbers quoted in the trek's own highlights count as sourced.

  Two dead ends on the way:
  - Listing the openings already used in the prompt ("start differently from…") made Gemma copy them.
  - Without a minimum length, drafts shrank to about 100 words.

  Result: 20 scripts, 122–155 words, no repeated openings, every number traceable to the YAML. That's 16,638 characters for ElevenLabs.

### Sunday evening: CI's first run, two stalls, and what got cut
- **CI's first run** (the repo's first push to GitHub, still private): the fast job passed, and Integration failed in the digest dry run with `forecast for harishchandragad failed: fetch failed`, an Open-Meteo call from the GitHub runner. Two things made that test fragile:
  - Any failed forecast made the whole run exit 1, even though that trek's email had already gone out saying "Forecast unavailable today".
  - It was Sunday in IST, so the dry run was also the weekly sweep: about 40 Open-Meteo calls from a shared runner, for a test that needs one trek.
- **The fix:**
  - A failed forecast is now counted on its own, not as an error. That email says "forecast unavailable", the log says how many treks failed and why (with Node's network error code, e.g. `fetch failed (UND_ERR_CONNECT_TIMEOUT)`), and the run exits 0. A failed email, a failed save or a full search budget still exits 1.
  - `FORECAST_MODE=fixtures` serves a recorded Open-Meteo sample (Kedarkantha's road head and summit, recorded on 11 Oct), re-dated from today. The email marks it SAMPLE DATA in the subject and above the forecast, and it is never stored, so it can't reach a trek page.
  - CI and the digest integration test use the fixtures and `--no-sweep`. Local runs and Render keep live Open-Meteo.
  - Unit tests cover all three: a failed forecast with the run still succeeding, a failed email still failing it, and the sample label.
- **Two stalls:** twice the laptop slept in the middle of a request and the session stopped. Both times nothing had been written, the tree was still clean at the last commit, and the work was redone from the top. The cost was time, not state, because work lands in small commits after the leak check. For Monday's long steps (Render's first deploy pulls about 12 GB of models), keep the machine awake.
- **Cut before publishing:** Sentry (it would add a third-party data flow the privacy notes don't cover) and Hindi audio (a check found nothing in the repo or the post that promises it).
- **Demo query:** shot 2 now uses "lakes high in the mountains with wildflowers", which finds Kashmir Great Lakes, Brahmatal, Kedarkantha, Valley of Flowers and Goecha La without naming any of them. The December snow query stays out of the demo, because Kedarkantha's winter months stay `null` until an open source names them. We changed the query, not the data.
- **Numbers:** 74 unit tests, and 13 integration tests in 38 s on the laptop.
