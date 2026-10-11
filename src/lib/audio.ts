import { existsSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

// Mono MP3 at 64 kbps: about 0.5 MB a minute, so 20 intros of a minute or so stay far below the budget.
export const AUDIO_FORMAT = "mp3_44100_64";
export const AUDIO_BUDGET_BYTES = 30 * 1024 * 1024;
const BYTES_PER_SECOND = 64_000 / 8;
const CHARS_PER_SECOND = 15; // narration pace, roughly 150 words a minute

export const audioFile = (dir: string, slug: string) => path.join(dir, `${slug}.en.mp3`);

export interface Script {
  slug: string;
  text: string;
}

// Which intros to make. Without --only, only treks that have no file yet; --force remakes existing ones.
export function selectAudio(scripts: Script[], o: { only?: string[]; force: boolean; exists: (slug: string) => boolean }): Script[] {
  return scripts.filter((s) => (!o.only || o.only.includes(s.slug)) && (o.force || !o.exists(s.slug)));
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

// Generates one intro at a time. A file only appears once a complete MP3 has arrived; on the first failure
// (credits used up, a bad key, the network) the run stops, and those treks keep "not recorded yet".
export async function generateAudio(
  todo: Script[],
  speak: (text: string) => Promise<Uint8Array>,
  dir: string,
  describeError: (e: unknown) => string,
): Promise<AudioRun> {
  const done: string[] = [];
  for (const [i, s] of todo.entries()) {
    const file = audioFile(dir, s.slug);
    const part = `${file}.part`;
    try {
      const audio = await speak(s.text);
      if (!isMp3(audio)) throw new Error("the response wasn't an MP3; nothing was saved");
      writeFileSync(part, audio);
      renameSync(part, file);
      done.push(s.slug);
    } catch (e) {
      rmSync(part, { force: true });
      return { done, failed: { slug: s.slug, reason: describeError(e) }, remaining: todo.slice(i).map((t) => t.slug) };
    }
  }
  return { done, failed: null, remaining: [] };
}

export function audioBytes(dir: string): number {
  if (!existsSync(dir)) return 0;
  return readdirSync(dir)
    .filter((f) => f.endsWith(".mp3"))
    .reduce((n, f) => n + statSync(path.join(dir, f)).size, 0);
}
