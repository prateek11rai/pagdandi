// Generate each trek's MP3 intro from its audio_script with ElevenLabs. The only place the ElevenLabs SDK is used.
// Usage: pnpm audio [--estimate] [--only slug,slug] [--force]
//   --estimate  count characters (credits) without calling the API
import { createWriteStream, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import { loadEnv } from "../src/lib/env";
import { readTrekFiles } from "../src/lib/trek-files";

const MODEL_ID = "eleven_multilingual_v2";
const OUT = path.join(process.cwd(), "public", "audio");

const estimate = process.argv.includes("--estimate");
const force = process.argv.includes("--force");
const onlyArg = process.argv.find((a, i) => process.argv[i - 1] === "--only");
const only = onlyArg ? new Set(onlyArg.split(",")) : null;

const todo = readTrekFiles()
  .flatMap((r) => (r.trek?.audio_script ? [{ slug: r.trek.slug, text: r.trek.audio_script }] : []))
  .filter((t) => !only || only.has(t.slug))
  .filter((t) => force || !existsSync(path.join(OUT, `${t.slug}.en.mp3`)));

const chars = todo.reduce((n, t) => n + t.text.length, 0);
console.log(`${todo.length} intro(s) to generate, ${chars.toLocaleString("en-IN")} characters`);
if (estimate || todo.length === 0) process.exit(0);

const env = loadEnv("audio");
const client = new ElevenLabsClient({ apiKey: env.ELEVENLABS_API_KEY });
mkdirSync(OUT, { recursive: true });
for (const t of todo) {
  const started = performance.now();
  const audio = await client.textToSpeech.convert(env.ELEVENLABS_VOICE_ID!, {
    text: t.text,
    modelId: MODEL_ID,
    outputFormat: "mp3_44100_128",
  });
  await pipeline(Readable.fromWeb(audio as never), createWriteStream(path.join(OUT, `${t.slug}.en.mp3`)));
  console.log(`✓ ${t.slug}.en.mp3 (${((performance.now() - started) / 1000).toFixed(1)}s)`);
}
