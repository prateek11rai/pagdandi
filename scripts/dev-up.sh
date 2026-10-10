#!/usr/bin/env bash
# Start local Postgres and Ollama if they aren't running, and record what we started
# so `pnpm dev:down` stops only that. Never kills or reuses anything by port.
set -euo pipefail

cd "$(dirname "$0")/.."
DATA=.data
STATE="$DATA/dev-up.state"
PGDATA="$DATA/pg"
PGPORT="${PAGDANDI_PGPORT:-54329}"
OLLAMA_URL="http://127.0.0.1:11434"
CHAT_MODEL="${CHAT_MODEL:-gemma4:e4b}"
EMBED_MODEL="${EMBED_MODEL:-embeddinggemma:300m}"

mkdir -p "$DATA"
touch "$STATE"

# --- Postgres (Homebrew postgresql@17 + pgvector) ---
if ! PG_PREFIX="$(brew --prefix postgresql@17 2>/dev/null)" || [ ! -x "$PG_PREFIX/bin/pg_ctl" ]; then
  echo "postgresql@17 not found. Install it with: brew install postgresql@17 pgvector" >&2
  exit 1
fi
PG_BIN="$PG_PREFIX/bin"

if "$PG_BIN/pg_isready" -q -h 127.0.0.1 -p "$PGPORT"; then
  echo "postgres: already running on 127.0.0.1:$PGPORT (not started by dev:up, won't be stopped by dev:down)"
else
  if [ ! -f "$PGDATA/PG_VERSION" ]; then
    echo "postgres: initialising $PGDATA"
    "$PG_BIN/initdb" -D "$PGDATA" -U pagdandi --auth=trust -E UTF8 --no-locale >/dev/null
  fi
  "$PG_BIN/pg_ctl" -D "$PGDATA" -l "$DATA/pg.log" -w \
    -o "-p $PGPORT -c listen_addresses=127.0.0.1 -c unix_socket_directories=''" start >/dev/null
  grep -qx postgres "$STATE" || echo postgres >> "$STATE"
  echo "postgres: started on 127.0.0.1:$PGPORT"
fi

for db in pagdandi pagdandi_test; do
  if ! "$PG_BIN/psql" -h 127.0.0.1 -p "$PGPORT" -U pagdandi -d postgres -tAc \
      "select 1 from pg_database where datname = '$db'" | grep -q 1; then
    "$PG_BIN/createdb" -h 127.0.0.1 -p "$PGPORT" -U pagdandi "$db"
    echo "postgres: created database $db"
  fi
done

# --- Ollama ---
if curl -sf "$OLLAMA_URL/api/version" >/dev/null; then
  echo "ollama: already running (not started by dev:up, won't be stopped by dev:down)"
else
  nohup ollama serve >"$DATA/ollama.log" 2>&1 &
  pid=$!
  echo "ollama $pid" >> "$STATE"
  for _ in $(seq 1 30); do
    curl -sf "$OLLAMA_URL/api/version" >/dev/null && break
    sleep 0.5
  done
  curl -sf "$OLLAMA_URL/api/version" >/dev/null || { echo "ollama: failed to start, see $DATA/ollama.log" >&2; exit 1; }
  echo "ollama: started (pid $pid)"
fi

models="$(ollama list 2>/dev/null | awk 'NR>1 {print $1}')"
for m in "$CHAT_MODEL" "$EMBED_MODEL"; do
  if ! grep -qE "^${m}(:latest)?$" <<<"$models"; then
    echo "ollama: model $m is missing. Pull it with: ollama pull $m"
  fi
done

# --- Migrations ---
if [ -d node_modules ]; then
  DATABASE_URL="postgres://pagdandi@127.0.0.1:$PGPORT/pagdandi" pnpm -s db:migrate
  DATABASE_URL="postgres://pagdandi@127.0.0.1:$PGPORT/pagdandi_test" pnpm -s db:migrate
fi

echo "dev:up done. DATABASE_URL=postgres://pagdandi@127.0.0.1:$PGPORT/pagdandi"
