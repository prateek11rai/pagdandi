#!/bin/sh
# Start Ollama, pull any missing model onto the disk, then load the chat model so the first chat isn't cold.
set -eu
ollama serve &
pid=$!
until ollama list >/dev/null 2>&1; do sleep 1; done
for m in ${PULL_MODELS:-gemma4:e4b embeddinggemma:300m}; do
  ollama show "$m" >/dev/null 2>&1 || ollama pull "$m"
done
ollama run "${CHAT_MODEL:-gemma4:e4b}" "" >/dev/null 2>&1 || true
wait "$pid"
