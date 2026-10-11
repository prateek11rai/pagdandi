// Generate each trek's MP3 intro from its audio_script with ElevenLabs, on this machine. The only place the
// ElevenLabs SDK is used. The files are committed; the site serves them itself.
// Usage: pnpm audio [--estimate] [--missing | --only slug,slug] [--force]
//   --estimate  count characters (credits) and the expected size, without calling the API
//   --missing   only treks without a file (the default when --only isn't given)
//   --only      just these treks; existing files are kept unless --force
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import { AUDIO_BUDGET_BYTES, AUDIO_FORMAT, audioBytes, audioFile, estimate, generateAudio, selectAudio } from "../src/lib/audio";
import { loadEnv } from "../src/lib/env";
import { readTrekFiles } from "../src/lib/trek-files";

const MODEL_ID = "eleven_multilingual_v2";
const OUT = path.join(process.cwd(), "public", "audio");
const mb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;

const arg = (name: string) => process.argv.find((_, i) => process.argv[i - 1] === name);
const only = arg("--only")?.split(",").map((s) => s.trim()).filter(Boolean);
const scripts = readTrekFiles().flatMap((r) => (r.trek?.audio_script ? [{ slug: r.trek.slug, text: r.trek.audio_script }] : []));
const unknown = (only ?? []).filter((s) => !scripts.some((t) => t.slug === s));
if (unknown.length > 0) {
  console.error(`No audio script for: ${unknown.join(", ")}`);
  process.exit(1);
}
const todo = selectAudio(scripts, { only, force: process.argv.includes("--force"), exists: (slug) => existsSync(audioFile(OUT, slug)) });

const e0 = estimate(todo);
console.log(`${todo.length} intro(s) to generate, ${e0.chars.toLocaleString("en-IN")} characters, about ${e0.megabytes.toFixed(1)} MB`);
if (process.argv.includes("--estimate") || todo.length === 0) process.exit(0);

const env = loadEnv("audio");
const client = new ElevenLabsClient({ apiKey: env.ELEVENLABS_API_KEY });
mkdirSync(OUT, { recursive: true });

// The voice's name goes into a small manifest next to the files, for the credits. Its ID stays in the env.
const voice = await client.voices.get(env.ELEVENLABS_VOICE_ID!).catch(() => null);
if (voice?.name) {
  writeFileSync(path.join(OUT, "manifest.json"), `${JSON.stringify({ voice: voice.name, model: MODEL_ID, format: AUDIO_FORMAT }, null, 2)}\n`);
}

const speak = async (text: string) => {
  const stream = await client.textToSpeech.convert(env.ELEVENLABS_VOICE_ID!, { text, modelId: MODEL_ID, outputFormat: AUDIO_FORMAT });
  return new Uint8Array(await new Response(stream as ReadableStream).arrayBuffer());
};
// Status code and ElevenLabs' own error status only: never the request, which carries the key.
const describe = (e: unknown) => {
  const err = e as { statusCode?: number; body?: { detail?: { status?: string } } };
  return err.statusCode ? `HTTP ${err.statusCode}${err.body?.detail?.status ? ` (${err.body.detail.status})` : ""}` : (e as Error).message;
};

const run = await generateAudio(todo, speak, OUT, describe);
for (const slug of run.done) console.log(`✓ ${path.basename(audioFile(OUT, slug))}`);
if (run.failed) {
  console.error(`✗ ${run.failed.slug}: ${run.failed.reason}. Stopped; not recorded yet: ${run.remaining.join(", ")}`);
}
const total = audioBytes(OUT);
console.log(`public/audio: ${mb(total)} in total (budget ${mb(AUDIO_BUDGET_BYTES)})`);
if (total > AUDIO_BUDGET_BYTES) {
  console.error("Over the size budget: check the format and the script lengths before committing.");
  process.exit(1);
}
process.exit(run.failed ? 1 : 0);
