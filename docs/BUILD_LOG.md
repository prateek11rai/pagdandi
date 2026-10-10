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
- **ESLint 9.39.5, not 10.** `eslint-plugin-react`, `-import` and `-jsx-a11y` declare `eslint ≤9` as a peer.

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
