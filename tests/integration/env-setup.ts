// Integration tests run against the local stack from `pnpm dev:up` (or CI's services), on the _test database.
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? "postgres://pagdandi@127.0.0.1:54329/pagdandi_test";
process.env.OLLAMA_BASE_URL ??= "http://127.0.0.1:11434";
process.env.ADMIN_EMAIL = "admin@example.com";
process.env.EMAIL_MODE = "dry-run";
process.env.NEWS_MODE = "fixtures";
process.env.MASTRA_TELEMETRY_DISABLED = "1";
// The tests stand in for a proxy: each request carries its own address, so they don't share one rate limit.
process.env.TRUST_PROXY = "true";
