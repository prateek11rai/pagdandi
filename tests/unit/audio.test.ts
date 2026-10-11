import { existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  AUDIO_BUDGET_BYTES,
  audioBytes,
  estimate,
  generateAudio,
  isMp3,
  manifestFile,
  mislabelled,
  planAudio,
  readManifest,
  scriptHash,
  type Manifest,
} from "@/lib/audio";
import { readTrekFiles } from "@/lib/trek-files";

// Test bytes only: a frame-sync header followed by zeros. Written to a temp folder, never to public/audio.
const fakeMp3 = () => new Uint8Array([0xff, 0xfb, 0x90, 0x64, 0, 0, 0, 0]);
const scripts = ["a", "b", "c"].map((slug) => ({ slug, text: `Script for ${slug}.` }));
const made = { voice: "Test Voice", model: "test-model", format: "mp3_44100_64" };
const at = new Date("2026-10-11T15:30:00.000Z");
const record = (text: string) => ({ script_sha256: scriptHash(text), chars: text.length, generated_at: at.toISOString() });
// a and b were made from today's scripts; c's file exists but was made from an older script.
const onRecord: Manifest = { ...made, intros: { a: record("Script for a."), b: record("Script for b."), c: record("An older script for c.") } };
const plan = (manifest: Manifest | null, exists: (slug: string) => boolean, o: { only?: string[]; force?: boolean } = {}) =>
  planAudio(scripts, manifest, { force: false, ...o, exists }).todo.map((s) => `${s.slug}: ${s.reason}`);

const dirs: string[] = [];
afterEach(() => dirs.splice(0).forEach((d) => rmSync(d, { recursive: true, force: true })));
const tempDir = () => dirs[dirs.push(mkdtempSync(path.join(tmpdir(), "audio-"))) - 1]!;

describe("audio intros", () => {
  it("skip a trek whose script matches the hash on record", () => {
    const { todo, unchanged } = planAudio(scripts, onRecord, { force: false, exists: () => true });
    expect(unchanged).toEqual(["a", "b"]);
    expect(todo.map((s) => s.slug)).toEqual(["c"]);
  });

  it("select a trek whose script changed, or whose file has no record", () => {
    expect(plan(onRecord, () => true)).toEqual(["c: script changed"]);
    expect(plan(null, () => true)).toEqual(["a: script changed", "b: script changed", "c: script changed"]);
  });

  it("select a trek whose MP3 is missing, even if it is on record", () => {
    expect(plan(onRecord, (slug) => slug !== "a")).toEqual(["a: missing", "c: script changed"]);
    expect(plan(null, () => false)).toEqual(["a: missing", "b: missing", "c: missing"]);
  });

  it("narrow to --only, and remake unchanged intros only with --force", () => {
    expect(plan(onRecord, () => true, { only: ["a", "c"] })).toEqual(["c: script changed"]);
    expect(plan(onRecord, () => true, { only: ["a"] })).toEqual([]);
    expect(plan(onRecord, () => true, { only: ["a"], force: true })).toEqual(["a: forced"]);
  });

  it("refuse a voice change that would leave intros on record mislabelled", () => {
    const exists = () => true;
    const other = { ...made, voice: "Another Voice" };
    expect(mislabelled(onRecord, made, scripts.slice(2), exists)).toEqual([]);
    expect(mislabelled(onRecord, other, scripts.slice(2), exists)).toEqual(["a", "b"]);
    expect(mislabelled(onRecord, other, scripts, exists)).toEqual([]);
    expect(mislabelled(null, other, scripts.slice(2), exists)).toEqual([]);
  });

  it("write a trek's manifest entry only after its MP3 is saved", async () => {
    const d = tempDir();
    writeFileSync(manifestFile(d), JSON.stringify({ ...made, intros: { b: record("An older script for b.") } }));
    let calls = 0;
    const speak = async () => {
      if (++calls === 2) throw Object.assign(new Error("quota"), { statusCode: 401 });
      return fakeMp3();
    };
    const run = await generateAudio(scripts, speak, d, (e) => `HTTP ${(e as { statusCode: number }).statusCode}`, made, () => at);
    expect(run.done).toEqual(["a"]);
    expect(readManifest(d)).toEqual({ ...made, intros: { a: record("Script for a."), b: record("An older script for b.") } });

    const empty = tempDir();
    await generateAudio(scripts, async () => Promise.reject(new Error("offline")), empty, (e) => (e as Error).message, made);
    expect(existsSync(manifestFile(empty))).toBe(false);
  });

  it("reject a manifest that isn't one", () => {
    const d = tempDir();
    writeFileSync(manifestFile(d), "{ not json");
    expect(() => readManifest(d)).toThrow(/isn't valid/);
    writeFileSync(manifestFile(d), JSON.stringify({ ...made, intros: { a: { script_sha256: "abc", chars: 1, generated_at: "today" } } }));
    expect(() => readManifest(d)).toThrow(/isn't valid/);
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
    const run = await generateAudio(scripts, speak, d, (e) => `HTTP ${(e as { statusCode: number }).statusCode}`, made);
    expect(run).toEqual({ done: ["a"], failed: { slug: "b", reason: "HTTP 401" }, remaining: ["b", "c"] });
    expect(readdirSync(d).sort()).toEqual(["a.en.mp3", "manifest.json"]);
  });

  it("never save a response that isn't an MP3", async () => {
    const d = tempDir();
    const run = await generateAudio(scripts.slice(0, 1), async () => new TextEncoder().encode("<html>error</html>"), d, (e) => (e as Error).message, made);
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
