import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { z } from "zod";

// Mono MP3 at 64 kbps: about 0.5 MB a minute, so 20 intros of a minute or so stay far below the budget.
export const AUDIO_FORMAT = "mp3_44100_64";
export const AUDIO_BUDGET_BYTES = 30 * 1024 * 1024;
const BYTES_PER_SECOND = 64_000 / 8;
const CHARS_PER_SECOND = 15; // narration pace, roughly 150 words a minute

export const audioFile = (dir: string, slug: string) => path.join(dir, `${slug}.en.mp3`);
export const manifestFile = (dir: string) => path.join(dir, "manifest.json");
export const scriptHash = (text: string) => createHash("sha256").update(text, "utf8").digest("hex");

export interface Script {
  slug: string;
  text: string;
}

// The record of what each committed intro was made from. The voice is its name, for the credits; never its ID.
const introRecord = z.strictObject({
  script_sha256: z.string().regex(/^[0-9a-f]{64}$/),
  chars: z.number().int().min(0),
  generated_at: z.iso.datetime(),
});
const manifestSchema = z.strictObject({
  voice: z.string().min(1),
  model: z.string().min(1),
  format: z.string().min(1),
  intros: z.record(z.string(), introRecord),
});
export type Manifest = z.infer<typeof manifestSchema>;
export type MadeWith = Pick<Manifest, "voice" | "model" | "format">;

export function readManifest(dir: string): Manifest | null {
  const file = manifestFile(dir);
  if (!existsSync(file)) return null;
  let data: unknown;
  try {
    data = JSON.parse(readFileSync(file, "utf8"));
  } catch {
    data = null;
  }
  const parsed = manifestSchema.safeParse(data);
  if (!parsed.success) throw new Error("The audio manifest (manifest.json) isn't valid: fix it, or delete it to remake every intro");
  return parsed.data;
}

function writeManifest(dir: string, m: Manifest): void {
  const intros = Object.fromEntries(Object.entries(m.intros).sort(([a], [b]) => a.localeCompare(b)));
  const file = manifestFile(dir);
  writeFileSync(`${file}.part`, `${JSON.stringify({ ...m, intros }, null, 2)}\n`);
  renameSync(`${file}.part`, file);
}

export type Reason = "missing" | "script changed" | "forced";
export interface Planned extends Script {
  reason: Reason;
}

// Which intros a run makes: a trek whose MP3 is missing, or whose script no longer matches the hash on record. An
// MP3 with no record counts as changed, since nothing says what it was made from. --only narrows the list, and
// --force also remakes unchanged ones.
export function planAudio(
  scripts: Script[],
  manifest: Manifest | null,
  o: { only?: string[]; force: boolean; exists: (slug: string) => boolean },
): { todo: Planned[]; unchanged: string[] } {
  const todo: Planned[] = [];
  const unchanged: string[] = [];
  for (const s of scripts) {
    if (o.only && !o.only.includes(s.slug)) continue;
    const reason: Reason | null = !o.exists(s.slug)
      ? "missing"
      : manifest?.intros[s.slug]?.script_sha256 !== scriptHash(s.text)
        ? "script changed"
        : o.force
          ? "forced"
          : null;
    if (reason) todo.push({ ...s, reason });
    else unchanged.push(s.slug);
  }
  return { todo, unchanged };
}

// The manifest names one voice, model and format for every intro. If this run makes intros differently, the ones it
// leaves alone would be mislabelled: these are the slugs to remake (or the run to change) first.
export function mislabelled(manifest: Manifest | null, made: MadeWith, todo: Script[], exists: (slug: string) => boolean): string[] {
  if (!manifest || (manifest.voice === made.voice && manifest.model === made.model && manifest.format === made.format)) return [];
  const remade = new Set(todo.map((s) => s.slug));
  return Object.keys(manifest.intros).filter((slug) => exists(slug) && !remade.has(slug));
}

export function estimate(scripts: Script[]): { chars: number; megabytes: number } {
  const chars = scripts.reduce((n, s) => n + s.text.length, 0);
  return { chars, megabytes: (chars / CHARS_PER_SECOND) * BYTES_PER_SECOND / 1024 / 1024 };
}

// Real audio only: an MP3 starts with an ID3 tag or an MPEG frame sync. Anything else is never saved.
export function isMp3(b: Uint8Array): boolean {
  if (b.length < 4) return false;
  const id3 = b[0] === 0x49 && b[1] === 0x44 && b[2] === 0x33;
  const sync = b[0] === 0xff && (b[1]! & 0xe0) === 0xe0;
  return id3 || sync;
}

export interface AudioRun {
  done: string[];
  failed: { slug: string; reason: string } | null; // the run stops at the first failure
  remaining: string[];
}

// Generates one intro at a time. A file only appears once a complete MP3 has arrived, and its manifest entry only
// once the file is in place, so a failed run never marks a trek as done. On the first failure (credits used up, a
// bad key, the network) the run stops, and those treks keep "not recorded yet".
export async function generateAudio(
  todo: Script[],
  speak: (text: string) => Promise<Uint8Array>,
  dir: string,
  describeError: (e: unknown) => string,
  made: MadeWith,
  now: () => Date = () => new Date(),
): Promise<AudioRun> {
  const manifest: Manifest = { ...made, intros: readManifest(dir)?.intros ?? {} };
  const done: string[] = [];
  for (const [i, s] of todo.entries()) {
    const file = audioFile(dir, s.slug);
    const part = `${file}.part`;
    try {
      const audio = await speak(s.text);
      if (!isMp3(audio)) throw new Error("the response wasn't an MP3; nothing was saved");
      writeFileSync(part, audio);
      renameSync(part, file);
    } catch (e) {
      rmSync(part, { force: true });
      return { done, failed: { slug: s.slug, reason: describeError(e) }, remaining: todo.slice(i).map((t) => t.slug) };
    }
    manifest.intros[s.slug] = { script_sha256: scriptHash(s.text), chars: s.text.length, generated_at: now().toISOString() };
    writeManifest(dir, manifest);
    done.push(s.slug);
  }
  return { done, failed: null, remaining: [] };
}

export function audioBytes(dir: string): number {
  if (!existsSync(dir)) return 0;
  return readdirSync(dir)
    .filter((f) => f.endsWith(".mp3"))
    .reduce((n, f) => n + statSync(path.join(dir, f)).size, 0);
}
