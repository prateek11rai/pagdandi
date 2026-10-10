# Render private service: Gemma behind Ollama, reachable only on Render's private network.
# Pinned by tag and digest (0.35.1, published 2026-10-02).
FROM ollama/ollama:0.35.1@sha256:292ee7945dfc3d5840a181f3ab86fedb1e66703e02c8af98b50f4da56b7e278c

# Models live on the persistent disk mounted at /data, so they are pulled once, not on every deploy.
ENV OLLAMA_HOST=0.0.0.0:11434 \
    OLLAMA_MODELS=/data/models \
    OLLAMA_KEEP_ALIVE=-1 \
    OLLAMA_NUM_PARALLEL=1 \
    OLLAMA_CONTEXT_LENGTH=8192

COPY entrypoint.sh /entrypoint.sh
EXPOSE 11434
ENTRYPOINT ["/bin/sh", "/entrypoint.sh"]
