# Pagdandi

India's open trek database: a Next.js site with a Gemma trek guide (Mastra), hybrid search on Postgres, daily trek updates, and audio intros.

DevRelay rules for this repo: follow `.claude/devrelay-rules.md` (gitignored; set up with `pnpm devrelay:setup`, see `docs/DEVRELAY_SETUP.md`).

## Commands
- `pnpm dev:up` / `pnpm dev:down`: start or stop local Postgres and Ollama (only what `dev:up` started).
- `pnpm dev`: run the app. `pnpm test`: unit tests (no services). `pnpm test:integration`: needs `pnpm dev:up`. `pnpm typecheck`, `pnpm lint`.
- `pnpm db:migrate`, `pnpm treks:validate`, `pnpm treks:load`, `pnpm treks:embed`: database and trek data pipeline. `pnpm search:eval`: the benchmark searches.
- `pnpm digest --dry-run`: the daily job, printing emails instead of sending.
- `pnpm news:check --trek <slug>`: one live SerpApi search, counted against the caps. Never in tests or CI. Diagnostic: `--query "<text>"` searches that text instead, through the same client and caps, and prints the reply's shape.
- `pnpm email:preview --trek <slug>`: render the digest and confirmation emails into `.data/outbox/` from sample data. Never sends.
- `pnpm subscribe:admin --trek <slug> --date YYYY-MM-DD`: subscribe ADMIN_EMAIL and send the confirmation email (a real email when `EMAIL_MODE=smtp`). Never prints the address.
- `pnpm audio --estimate`: which intros are missing or have a changed script, without calling ElevenLabs. `pnpm audio` spends ElevenLabs credits.
- `pnpm topo`: regenerate `public/brand/topo.svg`.

## Rules
- pnpm only, exact versions, and only versions public for 7+ days (`minimumReleaseAge` in `pnpm-workspace.yaml`). Never edit `.npmrc`.
- The lockfile may only reference `registry.npmjs.org` (a unit test checks this).
- Run `.git/info/leak-check.sh` before every commit. Never use `--no-verify`.
- No absolute paths, usernames or machine details in any file, commit message or screenshot.
- Never read or print `.env` or any secret. Modules that touch a key import `server-only`.
- Every trek fact needs a source in its YAML; unsourced facts are `null`. Never guess an altitude.
- The chat model never shows a number unchecked: cards render database values, and prose numbers go through `src/lib/fact-check.ts`.
- Logs never contain chat text, emails or tokens.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
