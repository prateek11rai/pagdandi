---
title: "Pagdandi: an open trek database that gets the group chat onto an actual trail"
published: false
tags: devchallenge, hf26challenge, opensource, webdev
cover_image: <!-- upload docs/img/cover.png to DEV and paste its URL here -->
---

*This is a submission for the [Hacktoberfest Open-Source AI Challenge Week 1: Touch Grass](https://dev.to/challenges/hacktoberfest-week1-2026-10-05)*

## What I Built

Every city has a version of this group chat. Five college friends in Delhi NCR (call them the Sunday-plans group; they're a composite of friend groups we all know) have been saying *"is baar pakka trek chalenge"* ("this time we're definitely going on a trek") for three years. They have different budgets. Two of them have never trekked. Nobody wants to be the one who plans it, so it never happens.

**[Pagdandi](https://github.com/prateek11rai/pagdandi)** (पगडंडी, "footpath") is built for that group. It's an open database of 20 well-known Indian treks, from Kedarkantha and the Kashmir Great Lakes to Kalsubai and the living root bridges of Nongriat, with three ways in:

- **A trek guide you can ask, right on the home page.** Tell it "5 of us, 2 first-timers, ₹12k each, 4 days in December, from Delhi", or tap "Lakes high in the mountains with wildflowers", and it recommends treks from the database, with a card for each. Its search understands meaning, not just names.
- **The whole database in one table.** All 20 treks with plain filters for region, month, days, difficulty and budget, each trek's audio intro in its row, and a "weak source" mark on any fact whose only source we couldn't fully trust.
- **Daily updates until you leave.** Whoever organises signs up with the travel date. Once a day they get one email: the forecast at the road head and the high point, this week's news (closures, landslides, snowfall, permits), every headline with its link, and **one thing to do outside today**, like a practice walk in the boots they'll trek in. The site marks this "coming soon": until Pagdandi has its own domain, only the admin gets the emails.

Then it gets out of the way. Each trek has a short audio introduction to listen to on the drive up, and a **one-page printable plan**: the day-by-day, permits, last mobile signal and the altitude chart. On the trail, the phone stays in a pocket.

The screen is the shortest part of the experience: a few minutes to choose, ten seconds of email a day, then the actual walking.

<!-- Paths are relative to the repo; replace them with the DEV-uploaded image URLs before publishing (see docs/RUNBOOK.md, step 5). -->
![New plan: a group's question, the guide's answer, three trek cards, an altitude note and buttons for the next steps](docs/img/home-thread-desktop.png)
*New plan, the home page. The Delhi group asks; the guide answers in a few sentences, and the cards, the altitude note and the next steps come from the database, not from the model.*

![The Treks table: name, state, days, max altitude, difficulty, season, budget and an audio intro for every trek](docs/img/treks-desktop.png)
*Treks: all 20 in one table. Filters are plain; "weak source" marks a fact whose only source we couldn't fully trust.*

![The Kedarkantha trek page on a phone: facts with weak-source marks, the altitude warning and the actions](docs/img/trek-mobile.png)
*Kedarkantha on a phone. The facts strip marks the two facts with a weak source, the altitude warning appears above 3,500 m, and the plan prints on one page.*

### Taking it outside

> **PLACEHOLDER: your notes and photos go here.**
> This is a *test walk*, not the trek itself: a park walk in Delhi NCR, listening to one trek's audio intro, with the printed one-page plan in a pocket, to see what using Pagdandi away from the screen feels like. Some questions to answer:
> - Which park, how long, which trek's intro and plan?
> - Did the audio work offline? Was it the right length?
> - Was the printed plan readable outdoors? What was missing?
> - What would you change after this walk?
> - Photos: the printed plan in hand, and the path.

## Demo

<!-- {% embed <unlisted video URL> %} -->

**Run it in 10 minutes**, plus the model download (a few GB). Pagdandi runs on a laptop; there's no hosted copy, and anyone can run their own. On a Mac with Homebrew:

```sh
brew install ollama postgresql@17 pgvector node@24 pnpm
git clone https://github.com/prateek11rai/pagdandi && cd pagdandi
pnpm install && cp .env.example .env    # set ADMIN_EMAIL; the rest has working defaults
pnpm dev:up                              # starts Postgres and Ollama if they aren't running
ollama pull gemma4:e4b && ollama pull embeddinggemma:300m
pnpm treks:load && pnpm treks:embed
pnpm dev                                 # http://localhost:3000
```

## Code

{% embed https://github.com/prateek11rai/pagdandi %}

## How I Built It

The open pieces are the core of how it works, not a layer on top.

**Gemma, on the laptop that serves the site.** The trek guide is Gemma 4 (`gemma4:e4b`), served by Ollama on the same machine as the site. There's no server and no per-chat bill, and the app refuses to send chats to an Ollama anywhere else unless you opt in. **EmbeddingGemma** (300M parameters, 768 dimensions) turns every trek and every query into vectors for search. Gemma also summarises the morning's news into at most three lines.

**Mastra drives the agent.** The guide is a Mastra agent with four read-only tools: `searchTreks`, `getTrek`, `getConditions` and `recommendTreks`. It streams to the AI SDK's `useChat` through `@mastra/ai-sdk`. The route builds the agent's options itself from text-only, length-capped messages, so a browser can't swap the instructions or raise the limits.

**The model never types a number we show unchecked.** This was the rule I cared about most. A model that confidently says "Kedarkantha is 4,200 m" is how people get hurt. So:

- Recommendations come back as a `recommendTreks` tool call with slugs and reasons. The cards are rendered from the database, not from the model's text.
- Every sentence the model streams passes through plain code before it leaves the server. Altitudes (in metres or feet), days, nights, distances and rupee amounts are compared with the database facts for the treks that sentence mentions. Anything that doesn't match becomes "(see the card)". Numbers the user typed ("₹12k each") are allowed back.
- Above 3,500 m, a safety note appears under the cards. It's deterministic: the UI adds it, not the model.

**Every fact in the data is sourced.** Each trek is a YAML file. The schema rejects any non-null fact unless one of its sources names that field. Research agents drafted the 20 treks from Wikipedia, Wikivoyage, OpenStreetMap, UNESCO and government pages; trekking companies were off limits. A second pass re-opened every source and checked every number. If a fact can't be sourced, it's `null`, and the site says "not known yet".

**Tiger Data holds it together.** One Postgres database has the treks, a hybrid search index (a generated `tsvector` plus a pgvector column, fused with reciprocal rank fusion), conditions history, subscriptions and the SerpApi budget counters.

**SerpApi** finds fresh Google News results for each trek, only from the daily job. It never runs from the chat, and every search first reserves budget against hard per-day and per-month caps. **ElevenLabs** voices each trek's intro once into an MP3 the site serves itself, so it works offline once downloaded.

Audio intros generated with [ElevenLabs](https://elevenlabs.io).

Here's the heart of the prose check, from `src/lib/fact-check.ts`. Each pattern (altitude, feet, distance, days, nights, rupees) finds a number with its unit. The number has to match the database for the trek the sentence is about, or be a number the user typed; anything else gets replaced:

```ts
for (const [kind, re] of PATTERNS) {
  for (const m of sentence.matchAll(re)) {
    const start = m.index!;
    const end = start + m[0].length;
    if (spans.some((s) => start < s.end && end > s.start)) continue; // already judged by an earlier pattern
    const value = toNumber(m[1]!, m[2]);
    const ok =
      ctx.userNumbers.includes(value) ||
      (kind === "altitude" && ALLOWED_ALTITUDES.includes(value)) ||
      treks.some((t) => matches(kind, value, t));
    spans.push({ start, end, ok });
  }
}
const bad = spans.filter((s) => !s.ok).sort((a, b) => b.start - a.start);
```

So "Kedarkantha reaches 4,200 m" streams out as "Kedarkantha reaches (see the card)". The answer arrives sentence by sentence, because the server holds each sentence back until it ends and has been checked.

## Why Does Open Innovation Matter?

- **Plans stay on the machine.** When five friends type their budgets, dates and who's never trekked, that goes to a model on the laptop that serves the site, not to a model company. Chats aren't stored or logged.
- **No server, no per-chat bill.** Pagdandi runs on a laptop, so a chat costs nothing beyond the electricity. Anyone can host their own copy for their own friends.
- **We could shape the model's job.** With open weights and a local runtime, I could turn Gemma's thinking off when it was wasting the whole token budget, use the smaller `e2b` on CI's CPU runner, and test everything on the laptop that runs it.
- **The data is open too.** CC BY-SA trek files that anyone can correct or extend by pull request, with CI validating every source. A closed API couldn't give us that.

What isn't local, so you know: **SerpApi** (news), **ElevenLabs** (the recorded audio), **Open-Meteo** (forecasts) and **Tiger Data** (the database) are hosted services. They see trek names, audio scripts, trek coordinates, and the guide's search queries and the admin's subscription, never the chat itself. Email goes out over SMTP from the admin's own mailbox, to the admin.

## What I Got Wrong

<!-- From docs/BUILD_LOG.md; edit freely -->
- **Thinking mode ate the answers.** With thinking on, Gemma spent all 300 tokens reasoning and never answered. Turning it off gave a full answer in under 3 seconds after the tool call.
- **"First-timers" meant "easy only".** The guide read "2 first-timers" as `difficulty: easy`, which ruled out every moderate beginner trek, and the group got nothing. Now the tool takes a maximum difficulty, and when nothing fits it returns the closest matches and says which constraint they miss.
- **A trek in Karnataka for a group in Delhi.** The guide's search tool filtered the group's limits *after* hybrid search had already cut each side to its top 8, so often only one trek survived, from anywhere in India. Now the limits are SQL filters inside the search, and the tool re-ranks by distance from the group's city. The Delhi group gets Dayara Bugyal in Uttarakhand first, every time.
- **Textbook hybrid search lost to a stray word.** OR-ing every word matched 19 of 20 treks, because every trek says "trek" and "day". `ts_rank` has no IDF, and with only 20 treks every trek sat somewhere in the vector list, so a single matching word ("near", "long") earned a fusion bonus. "Short trek near Delhi" ranked a trek in Nagaland first. The fix: drop words found in more than half the documents, and fuse only each side's top 8.
- **The summariser made sample news look real.** In development, recorded sample headlines start with "SAMPLE:". Gemma's tidy one-line summaries dropped that, so sample news read like real reports in the email. Now sample data is labelled outside the model, in both the email and the page.
- **The facts I couldn't find.** Kedarkantha is famous as a December snow trek, but no open source I could find names its winter months, so a December search doesn't find it. The rule is "never guess", and this is what it costs.
- **My first lint setup tripped my own leak check.** ESLint 9 is end-of-life, and its deprecation notice put an `eslint.org` URL into the lockfile, which my pre-commit check (only `registry.npmjs.org` allowed) rejected. Moving to ESLint 10 fixed the cause.

## My Agent Session

<!-- {% agent_session <id> %} — curated and scrubbed; published after review -->

## Prize Categories

- **Best Use of Gemma:** Gemma 4 runs the trek guide and the news summaries, and EmbeddingGemma powers search. Both run through Ollama on the laptop that serves the site.
- **Best Use of Tiger Data:** pgvector embeddings and hybrid full-text plus vector search for the agent, with conditions, subscriptions and API budget counters in the same Postgres.
- **Best Use of SerpApi:** fresh Google News results ground each trek's daily update and the agent's `getConditions` tool, behind hard daily and monthly caps.
- **Best Use of ElevenLabs:** narration for every trek, generated once from hand-written scripts that use only that trek's sourced facts, and served as MP3s for the trail.
- **Best Use of Mastra:** a Mastra agent over an open model, with read-only tools, structured recommendations and streaming chat.
