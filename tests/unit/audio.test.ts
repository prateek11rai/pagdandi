import { existsSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { AUDIO_BUDGET_BYTES, audioBytes, estimate, generateAudio, isMp3, selectAudio } from "@/lib/audio";
import { readTrekFiles } from "@/lib/trek-files";

// Test bytes only: a frame-sync header followed by zeros. Written to a temp folder, never to public/audio.
const fakeMp3 = () => new Uint8Array([0xff, 0xfb, 0x90, 0x64, 0, 0, 0, 0]);
const scripts = ["a", "b", "c"].map((slug) => ({ slug, text: `Script for ${slug}.` }));

let dir = "";
afterEach(() => dir && rmSync(dir, { recursive: true, force: true }));
const tempDir = () => (dir = mkdtempSync(path.join(tmpdir(), "audio-")));

describe("audio intros", () => {
  it("pick only treks without a file, unless named or forced", () => {
    const exists = (slug: string) => slug === "b";
    expect(selectAudio(scripts, { force: false, exists }).map((s) => s.slug)).toEqual(["a", "c"]);
    expect(selectAudio(scripts, { only: ["b", "c"], force: false, exists }).map((s) => s.slug)).toEqual(["c"]);
    expect(selectAudio(scripts, { only: ["b"], force: true, exists }).map((s) => s.slug)).toEqual(["b"]);
  });

  it("recognise a real MP3 header, and nothing else", () => {
    expect(isMp3(fakeMp3())).toBe(true);
    expect(isMp3(new TextEncoder().encode("ID3\u0004rest"))).toBe(true);
    expect(isMp3(new TextEncoder().encode('{"detail":"quota_exceeded"}'))).toBe(false);
    expect(isMp3(new Uint8Array([0, 0, 0, 0x20, 0x66, 0x74, 0x79, 0x70]))).toBe(false); // an MP4/M4A box
  });

  it("stop at the first failure, keep what finished, and leave no partial file", async () => {
    const d = tempDir();
    let calls = 0;
    const speak = async () => {
      if (++calls === 2) throw Object.assign(new Error("quota"), { statusCode: 401 });
      return fakeMp3();
    };
    const run = await generateAudio(scripts, speak, d, (e) => `HTTP ${(e as { statusCode: number }).statusCode}`);
    expect(run).toEqual({ done: ["a"], failed: { slug: "b", reason: "HTTP 401" }, remaining: ["b", "c"] });
    expect(readdirSync(d)).toEqual(["a.en.mp3"]);
  });

  it("never save a response that isn't an MP3", async () => {
    const d = tempDir();
    const run = await generateAudio(scripts.slice(0, 1), async () => new TextEncoder().encode("<html>error</html>"), d, (e) => (e as Error).message);
    expect(run.failed?.reason).toMatch(/wasn't an MP3/);
    expect(existsSync(path.join(d, "a.en.mp3"))).toBe(false);
    expect(readdirSync(d)).toEqual([]);
  });

  const all = () => readTrekFiles().flatMap((r) => (r.trek?.audio_script ? [{ slug: r.trek.slug, text: r.trek.audio_script }] : []));

  it("fit 20 intros comfortably inside the size budget", () => {
    expect(all()).toHaveLength(20);
    expect(estimate(all()).megabytes).toBeLessThan(AUDIO_BUDGET_BYTES / 1024 / 1024 / 2);
  });

  // One ElevenLabs free month is 10,000 characters: all the scripts together must fit in it.
  it("keep the 20 scripts together under 10,000 characters", () => {
    expect(all()).toHaveLength(20);
    expect(estimate(all()).chars).toBeLessThan(10_000);
  });

  it("committed files stay under the budget", () => {
    expect(audioBytes(path.join(process.cwd(), "public", "audio"))).toBeLessThanOrEqual(AUDIO_BUDGET_BYTES);
  });
});
