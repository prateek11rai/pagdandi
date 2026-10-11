# Runbook: from "env ready" to the published post

The exact steps, in order, for when the accounts exist. Each step has a check and a rollback. The challenge deadline is **Mon 12 Oct 06:59 UTC (12:29 IST)**; aim to publish by **11:00 IST**.

Run commands from the repository root. Keep secrets out of shell history: read a value with `read -rs NAME`, then `export NAME`. Never `echo` it.

## 0. Before you start

- [ ] Claim the Render and ElevenLabs credits at hacktoberfest.com/my/promos.
- [ ] Create accounts: Tiger Data, Render, SerpApi, ElevenLabs, Resend. Use the same email for Resend as `ADMIN_EMAIL`, because Resend's test sender only delivers to the account owner.
- [ ] Local stack up: `pnpm dev:up`. The unit tests should pass: `pnpm test`.
- [ ] The repo is pushed to GitHub (after your own leak check), and CI is green on `main`. Render deploys from GitHub.

## 1. Tiger Data: database, pgvector, treks, embeddings

1. In the Tiger Data console, create a **free** service in **AWS us-east-1**. Copy its connection string; it ends in `?sslmode=require`.
2. Point this shell at it, without echoing the value:
   ```sh
   read -rs TIGER_URL && export TIGER_URL
   ```
3. Migrate. The first migration runs `create extension if not exists vector`:
   ```sh
   DATABASE_URL="$TIGER_URL" pnpm db:migrate        # expect: applied 0001_init.sql, applied 0002_unsubscribe_tokens.sql
   ```
4. Check that pgvector is enabled:
   ```sh
   "$(brew --prefix postgresql@17)/bin/psql" "$TIGER_URL" -tAc "select extversion from pg_extension where extname = 'vector'"
   ```
5. Load the treks, then embed them with the laptop's EmbeddingGemma (`pnpm dev:up` must be running):
   ```sh
   DATABASE_URL="$TIGER_URL" pnpm treks:load        # expect: loaded 20 treks
   DATABASE_URL="$TIGER_URL" pnpm treks:embed       # expect: embedded 20 trek document(s)
   DATABASE_URL="$TIGER_URL" pnpm search:eval       # the five benchmark queries; compare with docs/BUILD_LOG.md
   ```
   If the connection fails with a certificate error, Tiger's free tier has no CA-signed certificate. Check that the URL says `sslmode=require` (encrypted, not verified), not `verify-full`.

**Rollback:** nothing depends on the database yet. Reset it with `psql "$TIGER_URL" -c "drop schema public cascade; create schema public;"`, or delete the service and start again.

## 2. Audio: ElevenLabs

1. In `.env` (gitignored), set `ELEVENLABS_API_KEY` and `ELEVENLABS_VOICE_ID`. Pick a voice in the ElevenLabs voice library; an Indian English voice suits the scripts.
2. Check the credit use first. This makes no API call:
   ```sh
   pnpm audio --estimate      # expect: 20 intro(s) to generate, 16,638 characters
   ```
   The Starter plan has 30,000 characters a month, so the Free plan's 10,000 is not enough. On the Free plan, ElevenLabs also requires "elevenlabs.io" in the title of anything published.
3. Generate one, and listen to it on `http://localhost:3000/treks/kedarkantha` with `pnpm dev`:
   ```sh
   pnpm audio --only kedarkantha
   ```
4. If it sounds right, generate the rest (about 1 minute), then commit after the leak check:
   ```sh
   pnpm audio
   git add public/audio && bash .git/info/leak-check.sh && git commit -m "Add audio intros"
   ```

**Rollback:** `git rm public/audio/*.mp3`. The trek pages fall back to "The audio intro for this trek is still being recorded."

## 3. One real email to the admin

1. In `.env`, set:
   - `EMAIL_MODE=resend`, `RESEND_API_KEY`, `ADMIN_EMAIL` (the Resend account's email);
   - `NEWS_MODE=serpapi`, `SERPAPI_API_KEY`;
   - `DATABASE_URL` pointing at Tiger.
2. Run `pnpm dev` and open `http://localhost:3000/updates?trek=kedarkantha`. Enter a travel date a week or two out and `ADMIN_EMAIL`, then **Get daily updates**.
3. The confirmation email arrives (check spam). Click **Confirm**, which leads to `/updates?status=confirmed`.
4. Send one digest. Use `--no-sweep`, so a Sunday run doesn't spend 20 searches:
   ```sh
   pnpm digest --no-sweep     # expect: 1 trek(s) checked, 1 email(s); one SerpApi search
   ```
5. Check the email: the subject reads "Kedarkantha · N days to go · …", with the forecast, news (or "Nothing new.") and one thing to do outside. Then check the SerpApi dashboard: usage should be 1.
6. Click **Stop these emails** in the message; it leads to `/updates?status=unsubscribed`.

**Rollback:** the unsubscribe link deletes the row. Otherwise, `psql "$TIGER_URL" -c "delete from subscriptions"`. Put `EMAIL_MODE=dry-run` and `NEWS_MODE=fixtures` back in `.env`.

## 4. Render: deploy the Blueprint

1. In Render, choose **New**, then **Blueprint**, pick the GitHub repo, and Render reads `render.yaml`. It lists `pagdandi-web`, `pagdandi-ollama` and `pagdandi-daily`, all in Virginia.
2. Paste the secrets Render asks for:

   | Service | Variable | Value |
   |---|---|---|
   | pagdandi-web | `DATABASE_URL` | Tiger connection string |
   | pagdandi-web | `ADMIN_EMAIL` | your Resend account email |
   | pagdandi-web | `RESEND_API_KEY` | Resend |
   | pagdandi-web | `SITE_URL` | `https://pagdandi-web.onrender.com` (if Render gives a different URL, fix it after the first deploy) |
   | pagdandi-daily | `DATABASE_URL`, `ADMIN_EMAIL`, `RESEND_API_KEY`, `SITE_URL` | same as the web service |
   | pagdandi-daily | `SERPAPI_API_KEY` | SerpApi |
   | pagdandi-ollama | none | |

3. Apply. `pagdandi-ollama` pulls `gemma4:e4b`, `gemma4:e2b` and `embeddinggemma:300m` (about 12 GB) onto its disk the first time it starts, which takes roughly 10 minutes; watch its logs. `pagdandi-web` migrates and loads on pre-deploy. Embedding was already done from the laptop in step 1.
4. Checks:
   ```sh
   URL=https://pagdandi-web.onrender.com
   curl -s "$URL/api/health"                      # {"ok":true,"db":true}
   curl -sI "$URL/" | grep -i content-security    # nonce CSP present
   ```
   Then open `/` (send one suggestion), `/treks`, a trek page, `/updates` and `/about` on a phone.
5. Measure chat latency. Run the group prompt three times; the per-IP rate limit allows 6 a minute:
   ```sh
   for i in 1 2 3; do
     curl -s -N -o /dev/null -w "run $i: first byte %{time_starttransfer}s, done %{time_total}s\n" -X POST "$URL/api/chat" \
       -H 'content-type: application/json' \
       -d '{"messages":[{"id":"m1","role":"user","parts":[{"type":"text","text":"5 of us, 2 first-timers, ₹12k each, 4 days in December, from Delhi"}]}]}'
     sleep 15
   done
   ```
   Also run it once without `-o /dev/null`, to see the chunks arrive one by one. That confirms Render's proxy streams them and doesn't buffer.
6. Decide between **e4b and e2b**:
   - Set `CHAT_MODEL=gemma4:e2b` on `pagdandi-web`, `pagdandi-daily` and `pagdandi-ollama`, save (this redeploys), and run step 5 again.
   - Keep `e4b` if a full answer takes under about 30 s; otherwise use `e2b`.
   - Record both sets of numbers in `docs/BUILD_LOG.md`, set the winner as the default in `render.yaml`, and commit.
7. Run the cron once: open **pagdandi-daily** and click **Trigger Run**. Its log should say "1 email(s)" if the admin is subscribed, or "0 email(s)" otherwise. Today's conditions then appear on the trek pages.

**Rollback:** in Render, **Suspend** each service; that stops instance billing, and the data in Tiger is unaffected. To start over, delete the three services (and the disk), fix `render.yaml`, and apply the Blueprint again. Costs while running: Ollama "pro plus" at about $175 a month billed by the second, plus the $7 web service, at least $1 for the cron job, and about $5 for the disk.

## 5. Fill the post's placeholders (`docs/devto-post.md`)

- [ ] **Live URL:** in the post's Demo section and in the README's "Try it".
- [ ] **Screenshots:**
  - In the DEV editor, upload `docs/img/home-thread-desktop.png`, `docs/img/treks-desktop.png` and `docs/img/trek-mobile.png`, and replace the relative paths with the uploaded URLs.
  - Upload `docs/img/cover.png` as the cover.
  - The other screenshots in `docs/img/` (each page at 1440 and 390 px wide) are there if a section needs one.
- [ ] **Taking it outside:** your test-walk notes and photos. Say plainly that it was a park test walk, not the trek.
- [ ] **Demo video:**
  - Record it from the shot list below.
  - Upload it unlisted.
  - Embed it with `{% embed <url> %}`.
- [ ] **Agent session:**
  - I build the curated, scrubbed transcript and show it to you.
  - Nothing is sent to DevRelay until you and Prateek approve.
  - Prateek publishes it on DEV, then embed it with `{% agent_session <id> %}`.
- [ ] **README:** add the post link under "Built for", and list any commit made after 12 Oct 06:59 UTC, with its date, under "After the deadline".
- [ ] **DEV:**
  - Once the post is approved, I create it as a DEV draft (`published: false`) through DevRelay.
  - Prateek reviews it and publishes it himself, with the tags `devchallenge, hf26challenge, opensource, webdev`.

**Rollback:** a draft can be edited or deleted on DEV, and a published post can be unpublished, but publish only once it's final.

### Demo video shot list (about 2½ minutes)

| # | Shot | Narration |
|---|---|---|
| 1 | Cover image, then New plan: the question, the composer and the three suggestions | "Every friend group has a trek they've talked about for years. Pagdandi is for getting it out of the group chat and onto a trail." |
| 2 | Tap "Lakes high in the mountains with wildflowers"; the cards stream in | "The guide understands what you mean, not just names: full-text search and Gemma embeddings in one Postgres." |
| 3 | Treks: the table; set Month to August; play one intro from its row | "All 20 treks in one table. Every fact is sourced, and a weak source is marked as one." |
| 4 | Kedarkantha: facts with weak-source marks, the altitude warning, the figure with "Camp altitudes not known", sources; 5 s of audio | "Every number here has a source. If we couldn't find one, it says so. We don't guess altitudes." |
| 5 | New plan: tap the Delhi group; cards, the altitude note and the three actions | "The guide is Gemma on our own server. It picks treks near you, the cards come from the database, and code checks every number it says." |
| 6 | Get daily updates for the top pick, then the morning email | "One email a day until you leave: the forecast, any news, and one thing to do outside today." |
| 7 | Print the one-page plan; download the MP3; your park test walk | "On the trail, the phone stays in your pocket." |
| 8 | The repo page | "The data is open. Fix a trek, or add yours." |
