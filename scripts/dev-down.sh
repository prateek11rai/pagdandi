#!/usr/bin/env bash
# Stop only what `pnpm dev:up` started, as recorded in .data/dev-up.state.
set -euo pipefail

cd "$(dirname "$0")/.."
DATA=.data
STATE="$DATA/dev-up.state"

if [ ! -s "$STATE" ]; then
  echo "dev:down: nothing was started by dev:up"
  exit 0
fi

while read -r what pid; do
  case "$what" in
    postgres)
      PG_BIN="$(brew --prefix postgresql@17)/bin"
      "$PG_BIN/pg_ctl" -D "$DATA/pg" -m fast stop >/dev/null && echo "postgres: stopped"
      ;;
    ollama)
      if [ -n "${pid:-}" ] && [ "$(ps -p "$pid" -o comm= 2>/dev/null | xargs basename 2>/dev/null)" = "ollama" ]; then
        kill "$pid" && echo "ollama: stopped (pid $pid)"
      else
        echo "ollama: pid ${pid:-?} is no longer ollama, leaving it alone"
      fi
      ;;
  esac
done < "$STATE"

rm -f "$STATE"
