import path from "node:path";
import { defineConfig } from "vitest/config";

const root = import.meta.dirname;

export default defineConfig({
  resolve: {
    alias: {
      "@": path.join(root, "src"),
      // `server-only` throws outside React's server build; tests run in plain Node.
      "server-only": path.join(root, "tests/server-only-stub.ts"),
    },
  },
  test: {
    projects: [
      { extends: true, test: { name: "unit", include: ["tests/unit/**/*.test.{ts,tsx}"] } },
      {
        extends: true,
        test: {
          name: "integration",
          include: ["tests/integration/**/*.test.ts"],
          setupFiles: ["tests/integration/env-setup.ts"],
          testTimeout: 180_000,
          hookTimeout: 120_000,
          fileParallelism: false,
        },
      },
    ],
  },
});
