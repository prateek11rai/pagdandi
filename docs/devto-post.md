---
title: "Pagdandi: an open trek database that gets the group chat onto an actual trail"
published: false
tags: devchallenge, hf26challenge, opensource, webdev
cover_image: https://raw.githubusercontent.com/prateek11rai/pagdandi/main/docs/img/cover.png
---

*This is a submission for the [Hacktoberfest Open-Source AI Challenge Week 1: Touch Grass](https://dev.to/challenges/hacktoberfest-week1-2026-10-05)*

> **TL;DR** Pagdandi is an open database of 20 Indian treks, every fact sourced, with a trek guide that runs on Gemma on a laptop.
> Tell it who's going, the budget, the days and where you start; it picks treks you can actually do, and code checks every number it says.
> Then it gets out of the way: a half-minute audio intro, a one-page plan, and one email a day until you leave.

## What I Built

Every city has this group chat. Five college friends in Delhi NCR (a composite of groups we all know) have been saying *"is baar pakka trek chalenge"* ("this time we're definitely going on a trek") for three years. Different budgets, two first-timers, and nobody wants to be the one who plans it.

**[Pagdandi](https://github.com/prateek11rai/pagdandi)** (पगडंडी, "footpath") is for them. Four ways in:

**Ask the guide.** "5 of us, 2 first-timers, ₹12k each, 4 days in December, from Delhi." The answer is a few sentences and a card per trek, nearest first.

<!-- Images load from the public repo's raw URLs on main, so nothing needs uploading; DEV may re-host them. Local paths: docs/img/cover.png (cover), flow.png, home-thread-desktop.png, treks-desktop.png, trek-mobile.png, audio-intro.png, email-kedarkantha.png, kedarnath-2026.jpg. -->
![New plan: a group's question, the guide's answer, three trek cards, an altitude note and buttons for the next steps](https://raw.githubusercontent.com/prateek11rai/pagdandi/main/docs/img/home-thread-desktop.png)
*The cards, the altitude note and the next steps come from the database, not from the model.*

**Browse the table.** All 20 treks, plain filters, an audio intro in every row, and a "weak source" mark on any fact with only one shaky source.

![The Treks table: name, state, days, max altitude, difficulty, season, budget and an audio intro for every trek](https://raw.githubusercontent.com/prateek11rai/pagdandi/main/docs/img/treks-desktop.png)

**Open a trek.** Sources for every fact, an altitude warning above 3,500 m, a plan that prints on one page, and an audio intro to download for the drive.

![The Kedarkantha trek page on a phone: facts with weak-source marks, the altitude warning and the actions](https://raw.githubusercontent.com/prateek11rai/pagdandi/main/docs/img/trek-mobile.png)

**Get daily updates.** Sign up with the travel date and get one email a day until you leave: the forecast at the road head and the high point, the week's headlines with links, and one thing to do outside today. Until Pagdandi has a domain, only the admin gets them.

![The daily email for Kedarkantha: 14 days to go, the forecast at Sankri and at the summit with heavy snow, no news this week, and one thing to do outside today](https://raw.githubusercontent.com/prateek11rai/pagdandi/main/docs/img/email-kedarkantha.png)
*This morning's real email for Kedarkantha. Open-Meteo's forecast and a SerpApi news search feed it; this week the search found nothing, so it says so.*

### Taking it outside

![Snow-covered peaks under heavy cloud above a green valley, with mist along the ridges, a stream on the slopes and an Indian tricolour on a pole beside a blue tent roof](https://raw.githubusercontent.com/prateek11rai/pagdandi/main/docs/img/kedarnath-2026.jpg)
*Kedarnath, on our recent trip, before Pagdandi existed.*

This photo is from Kedarnath, where my friends and I went recently: cloud sitting on the snow peaks, and the slopes green from the monsoon. Kedarnath is a pilgrimage walk, and it isn't one of Pagdandi's 20 treks yet. We didn't use Pagdandi on that trip either. It didn't exist.

That trip was the exception. Most of the time we're the group from the top of this post. We plan the next one at our desks, the chat stalls on "which one can all of us actually do?", and nobody gets up.

Pagdandi is built for that moment: ten minutes to agree on a trek, then the phone goes in a pocket, with the intro downloaded and the one-page plan printed. And because the data is open, every group that plans with it can leave it better for the next one. Kedarnath is the natural first addition, by pull request, sourced like every other trek.

## Demo

**[Watch the demo](https://github.com/prateek11rai/pagdandi/blob/main/docs/demo/pagdandi-demo.mp4)** (2½ minutes, plays on GitHub): the guide, the table, a trek page and its plan, then a sign-up and the email.

There's no hosted copy: Pagdandi runs on a laptop. Running your own takes about 10 minutes, plus the model download:

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

{% github prateek11rai/pagdandi %}

## How I Built It

![How Pagdandi works: the group's question goes to New plan (Gemma 4 via Ollama, a Mastra agent with four read-only tools) on the laptop, which searches Postgres on Tiger Data (20 sourced treks, hybrid search) and returns cards from the database with fact-checked prose; a card opens the trek page (sources, weak-source marks, an ElevenLabs audio intro, a one-page plan); signing up starts daily updates, where Open-Meteo's forecast and SerpApi's headlines, with Gemma's one-line "What matters", become a branded email over SMTP](https://raw.githubusercontent.com/prateek11rai/pagdandi/main/docs/img/flow.png)
*Solid boxes run on the laptop; dashed boxes are hosted services.*

- **Gemma 4 on the laptop.** `gemma4:e4b` runs through Ollama on the machine that serves the site, so a chat costs nothing and never reaches a model company. **EmbeddingGemma** (768 dimensions) turns treks and questions into vectors. The app refuses a remote Ollama unless you opt in.
- **Mastra runs the agent**, with four read-only tools: `searchTreks`, `getTrek`, `getConditions` and `recommendTreks`. The server builds the agent's options from text-only, length-capped messages, so a browser can't swap the prompt or raise the limits.
- **Tiger Data** holds one Postgres: the treks, a hybrid index (a generated `tsvector` plus a pgvector column, fused with reciprocal rank fusion), conditions, subscriptions and the API budget counters.
- **SerpApi** finds the week's Google News for each followed trek, only from the daily job and behind hard daily and monthly caps. Gemma adds one "What matters" line on top; the reader still sees every headline.
- **ElevenLabs** voiced all 20 intros once, from scripts I wrote by hand from each trek's sourced facts. The MP3s are committed, so the site serves them itself and they play offline.

![The Listen block on the Kedarkantha page, with the player at 0:08 of 0:31](https://raw.githubusercontent.com/prateek11rai/pagdandi/main/docs/img/audio-intro.png)
*Voiced by ElevenLabs from the trek's sourced script.* Listen to the [Kedarkantha intro (32 s)](https://cdn.jsdelivr.net/gh/prateek11rai/pagdandi@main/public/audio/kedarkantha.en.mp3) or the [Valley of Flowers intro (30 s)](https://cdn.jsdelivr.net/gh/prateek11rai/pagdandi@main/public/audio/valley-of-flowers.en.mp3).

Audio intros generated with [ElevenLabs](https://elevenlabs.io).

**The rule I cared about most: the model never shows a number unchecked.** A guide that confidently says "Kedarkantha is 4,200 m" is how people get hurt.

- Cards render database values, never the model's.
- Every sentence the model streams is checked in code before it leaves the server. Altitudes, days, distances and rupees must match the data for the trek it names, or the user's own numbers; anything else becomes "(see the card)".
- The altitude note above 3,500 m comes from the UI, not the model.
- A red-team suite runs real Gemma against prompt injection, off-topic requests, treks we don't have and a request for its instructions. When CI caught Gemma copying its rules, a guard went in that replaces any sentence copying eight words in a row from them.

```ts
// simplified from src/lib/fact-check.ts: one pattern (altitude, days, distance or rupees) at a time
for (const m of sentence.matchAll(re)) {
  const value = toNumber(m[1]!, m[2]);
  const ok =
    ctx.userNumbers.includes(value) ||
    treks.some((t) => matches(kind, value, t));
  spans.push({ start: m.index!, end: m.index! + m[0].length, ok });
}
```

**Every fact is sourced.** Each trek is a YAML file, and the schema rejects any fact no source names. Agents drafted the 20 from Wikipedia, Wikivoyage, OpenStreetMap, UNESCO and government pages, with trekking companies off limits, and a second pass re-checked every number. What can't be sourced stays `null`, and the site says "not known yet".

## Why Does Open Innovation Matter?

- **Plans stay on the machine.** Budgets, dates and who's never trekked go to a model on the laptop, not to a model company. Chats aren't stored.
- **No per-chat bill.** Anyone can run a copy for their own friends.
- **We could shape the model's job.** Open weights and a local runtime let me turn thinking off when it ate the token budget, and run the smaller `e2b` on CI's CPU runner.
- **The data is open too.** CC BY-SA trek files that anyone can fix or extend by pull request, with CI validating every source.

Hosted services see a little: SerpApi trek names, ElevenLabs the scripts, Open-Meteo coordinates, Tiger Data the search queries and the admin's subscription; the email leaves from the admin's own mailbox. None of them sees the chat.

## What I Got Wrong

<!-- From docs/BUILD_LOG.md; edit freely -->
- **Thinking mode ate the answers.** Gemma spent its whole budget reasoning and never answered. Off, it answered in under 3 seconds.
- **"First-timers" meant "easy only".** That ruled out every moderate beginner trek. The search now takes a maximum difficulty and says which limit the closest matches miss.
- **Textbook hybrid search lost to a stray word.** Every trek says "trek" and "day", so "short trek near Delhi" ranked Nagaland first. Dropping words found in most documents, and fusing fewer results, fixed it.
- **Gemma judged the news, and missed what mattered.** It skipped a temple near Ghangaria, the base for the Valley of Flowers, closing for the season, and an earthquake in Uttarkashi. Now the email shows every headline, and Gemma only adds one line.
- **The facts I couldn't find.** No open source names Kedarkantha's winter months, so a December search misses it. "Never guess" has a cost.

## My Agent Session

The curated build session, from the scaffold to the first real email, with the commands that ran and their output:

{% agent_session 803 %}

## Prize Categories

- **Best Use of Gemma:** Gemma 4 runs the guide and the news line; EmbeddingGemma powers search. Both on the laptop, through Ollama.
- **Best Use of Tiger Data:** pgvector plus full-text hybrid search for the agent, with conditions, subscriptions and budget counters in the same Postgres.
- **Best Use of SerpApi:** each trek's weekly headlines in the daily email and the agent's `getConditions` tool, behind hard caps.
- **Best Use of ElevenLabs:** a half-minute intro for every trek, voiced once from a sourced script and served for the trail.
- **Best Use of Mastra:** a Mastra agent over an open model, with read-only tools, structured recommendations and streaming chat.
