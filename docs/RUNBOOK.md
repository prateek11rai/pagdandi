# Runbook: from the accounts to the published post

The exact steps, in order. Pagdandi runs on the laptop: there's no hosting step. Each step has a check and a rollback. The challenge deadline is **Mon 12 Oct 06:59 UTC (12:29 IST)**; aim to publish by **11:00 IST**.

Run commands from the repository root. Keep secrets out of shell history: read a value with `read -rs NAME`, then `export NAME`, or put it in `.env` (gitignored). Never `echo` one.

## 0. Before you start

- [ ] Accounts: SerpApi (done). Still to come: Tiger Data, ElevenLabs, and an SMTP mailbox for the admin (for Gmail, an app password).
- [ ] Claim the ElevenLabs credit at hacktoberfest.com/my/promos.
- [ ] Local stack up: `pnpm dev:up`. Unit tests pass: `pnpm test`. CI is green on `main`.

## 1. Tiger Data: database, pgvector, treks, embeddings

1. In the Tiger Data console, create a **free** service. Copy its connection string; it ends in `?sslmode=require`.
2. Point this shell at it without echoing the value: `read -rs TIGER_URL && export TIGER_URL`.
3. Migrate. The first migration runs `create extension if not exists vector`:
   ```sh
   DATABASE_URL="$TIGER_URL" pnpm db:migrate        # expect: applied 0001_init.sql, applied 0002_unsubscribe_tokens.sql
   "$(brew --prefix postgresql@17)/bin/psql" "$TIGER_URL" -tAc "select extversion from pg_extension where extname = 'vector'"
   ```
4. Load the treks, embed them with the laptop's EmbeddingGemma, and run the benchmark searches:
   ```sh
   DATABASE_URL="$TIGER_URL" pnpm treks:load        # expect: loaded 20 treks
   DATABASE_URL="$TIGER_URL" pnpm treks:embed       # expect: embedded 20 trek document(s)
   DATABASE_URL="$TIGER_URL" pnpm search:eval       # compare with docs/BUILD_LOG.md
   ```
   If the connection fails on a certificate, check that the URL says `sslmode=require` (encrypted, not verified), not `verify-full`.
5. Put the Tiger URL in `.env` as `DATABASE_URL`, restart `pnpm dev`, and open a trek page and the guide.

**Rollback:** set `DATABASE_URL` back to the local one from `.env.example`. To reset Tiger: `psql "$TIGER_URL" -c "drop schema public cascade; create schema public;"`, or delete the service.

## 2. Audio from the laptop: ElevenLabs

1. In `.env`, set `ELEVENLABS_API_KEY` and `ELEVENLABS_VOICE_ID`. The voice must be a premade one, from the **Default** tab under Voices, not the Voice Library: on the free plan the API refuses every Library voice with HTTP 402 ("Free users cannot use library voices via the API"). None of the 21 premade voices is Indian English; we use George.
2. Check the credits and the size first. This makes no API call:
   ```sh
   pnpm audio --estimate      # expect: 20 intro(s) to generate, 9,207 characters, about 4.7 MB
   ```
   The free plan's 10,000 characters a month covers it, with a little room for a retry; a unit test keeps the 20 scripts under 10,000. The free plan has no commercial licence, and anything published with its audio must carry "elevenlabs.io" or "11.ai" in its title.
3. Make two, and listen on `http://localhost:3000/treks/kedarkantha` and `/treks/triund`:
   ```sh
   pnpm audio --only kedarkantha,triund
   ```
4. If they sound right, make the rest; `pnpm audio` skips the two you have. If the credits run out, the script stops and lists the treks still to do:
   ```sh
   pnpm audio                  # expect: ✓ for each, and "public/audio: … MB in total" under 30 MB
   ```
5. Fill in the voice's name in the README (*License and attribution*); `public/audio/manifest.json` has it. Commit the MP3s and the manifest together, after the leak check:
   ```sh
   git add public/audio README.md && bash .git/info/leak-check.sh && git commit -m "Add audio intros"
   ```

**Rollback:** `git rm -r public/audio`. Trek pages fall back to "The audio intro for this trek is still being recorded", and the table to "not recorded yet".

## 3. One real digest email over SMTP

1. In `.env`, set:
   - `EMAIL_MODE=smtp`, `SMTP_HOST`, `SMTP_PORT` (587, or 465), `SMTP_USER`, `SMTP_PASS`, and `ADMIN_EMAIL` (the mailbox you'll read);
   - `NEWS_MODE=serpapi` and `SERPAPI_API_KEY`;
   - `DATABASE_URL` pointing at Tiger.
2. To look at the emails first, `pnpm email:preview --trek kedarkantha` writes the digest and the confirmation to `.data/outbox/` as HTML and text, from sample data; it never sends. Open the `.html` files in a browser.
3. Run `pnpm dev`, open `http://localhost:3000/updates?trek=kedarkantha`, pick a travel date a week or two out, enter `ADMIN_EMAIL`, and choose **Get daily updates**.
4. The confirmation email arrives (check spam). Click **Confirm daily updates**, which leads to `/updates?status=confirmed`.
5. Optional, to check SerpApi and Gemma's summary on their own: `pnpm news:check --trek kedarkantha` makes exactly one search, counted against the caps, prints the headlines, the summary and the counters, and saves nothing else.
6. Send one digest. `--no-sweep` keeps a Sunday run from spending 20 searches:
   ```sh
   pnpm digest --no-sweep     # expect: 1 trek(s) checked, 1 email(s); one SerpApi search
   ```
7. Check the email: the subject reads "Pagdandi · Kedarkantha · N days to go · …", with the forecast, the news (or "Nothing new.") and one thing to do outside. The SerpApi dashboard should show one more search.
8. Click **Stop these emails** in the message; it leads to `/updates?status=unsubscribed`.
9. Optional: schedule it for 7:00 IST with the cron line in the README.

**Rollback:** the unsubscribe link deletes the row; otherwise `psql "$TIGER_URL" -c "delete from subscriptions"`. Set `EMAIL_MODE=dry-run` and `NEWS_MODE=fixtures` again in `.env`. If the mailbox rejects the login, the digest logs only a code (`EAUTH`): check the app password.

## 4. Demo video

Record from the shot list below, with the app running locally on Tiger. Upload it unlisted.

**Rollback:** re-record; nothing else depends on it.

### Shot list (about 2½ minutes)

| # | Shot | Narration |
|---|---|---|
| 1 | The README banner on GitHub, then New plan running locally at `localhost:3000` | "Every friend group has a trek they've talked about for years. Pagdandi is for getting it out of the group chat and onto a trail. It runs on a laptop, model and all." |
| 2 | Tap "Lakes high in the mountains with wildflowers"; the cards stream in | "The guide understands what you mean, not just names: full-text search and Gemma embeddings in one Postgres." |
| 3 | Treks: the table; set Month to August; play one intro from its row | "All 20 treks in one table. Every fact is sourced, and a weak source is marked as one." |
| 4 | Kedarkantha: facts with weak-source marks, the altitude warning, the figure with "Camp altitudes not known", sources; 5 s of audio | "Every number here has a source. If we couldn't find one, it says so. We don't guess altitudes." |
| 5 | New plan: tap the Delhi group; cards, the altitude note and the three actions | "The guide is Gemma on this laptop. It picks treks near you, the cards come from the database, and code checks every number it says." |
| 6 | Get daily updates for the top pick, then the morning email in the mailbox | "One email a day until you leave: the forecast, any news, and one thing to do outside today." |
| 7 | Print the one-page plan; download the MP3; your park test walk | "On the trail, the phone stays in your pocket." |
| 8 | The repo page and "Run it" | "The data is open, and so is the whole thing. Run your own copy, fix a trek, or add yours." |

## 5. Fill the post's placeholders (`docs/devto-post.md`)

- [ ] **Video:** embed it in Demo with `{% embed <url> %}`. Demo has no live URL: "Run it in 10 minutes" stays.
- [ ] **Screenshots:** in the DEV editor, upload `docs/img/home-thread-desktop.png`, `docs/img/treks-desktop.png` and `docs/img/trek-mobile.png`, and replace the relative paths with the uploaded URLs. Upload `docs/img/cover.png` as the cover.
- [ ] **Taking it outside:** your test-walk notes and photos. Say plainly that it was a park test walk, not the trek.
- [ ] **README:** the post link under "Built for", and any commit made after 12 Oct 06:59 UTC, with its date, under "After the deadline".

## 6. Agent session

- I build the curated, scrubbed transcript and show it to you.
- Nothing is sent to DevRelay until you and Prateek approve.
- Prateek publishes it on DEV, and the post embeds it with `{% agent_session <id> %}`.

## 7. DEV draft

- Once the post is approved, I create it as a DEV draft (`published: false`) through DevRelay.
- Prateek reviews it and publishes it himself, with the tags `devchallenge, hf26challenge, opensource, webdev`.
- Right before publishing, the repository goes public, after a full-history scan.

**Rollback:** a draft can be edited or deleted on DEV, and a published post can be unpublished; publish only once it's final.
