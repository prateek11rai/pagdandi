import { defineConfig, globalIgnores } from "eslint/config";
import tseslint from "typescript-eslint";
import nextPlugin from "@next/eslint-plugin-next";
import reactHooks from "eslint-plugin-react-hooks";

export default defineConfig([
  globalIgnores([".next/**", "node_modules/**", "public/**", ".data/**", "next-env.d.ts"]),
  ...tseslint.configs.recommended,
  {
    plugins: { "@next/next": nextPlugin },
    rules: { ...nextPlugin.configs.recommended.rules, ...nextPlugin.configs["core-web-vitals"].rules },
  },
  reactHooks.configs.flat["recommended-latest"],
]);
