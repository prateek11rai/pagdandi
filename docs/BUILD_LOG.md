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
