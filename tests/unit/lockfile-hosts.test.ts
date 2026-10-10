import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// The lockfile may only point at the public npm registry. This is an allowlist on purpose.
const ALLOWED_HOSTS = new Set(["registry.npmjs.org"]);

describe("pnpm-lock.yaml", () => {
  const lock = readFileSync(path.join(import.meta.dirname, "../../pnpm-lock.yaml"), "utf8");

  it("mentions no host outside the allowlist", () => {
    const hosts = [...lock.matchAll(/[a-z][a-z0-9+.-]*:\/\/([^/\s"'@:]+)/gi)].map((m) => m[1]!.toLowerCase());
    const others = [...new Set(hosts.filter((h) => !ALLOWED_HOSTS.has(h)))];
    expect(others).toEqual([]);
  });

  it("has no git or file dependencies", () => {
    expect(lock).not.toMatch(/\b(git\+|github:|file:|link:)/);
  });
});
