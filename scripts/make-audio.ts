// Generate each trek's MP3 intro from its audio_script with ElevenLabs, on this machine. The only place the
// ElevenLabs SDK is used. The files are committed with public/audio/manifest.json, the record of what each was
// made from; the site serves them itself.
// Usage: pnpm audio [--estimate] [--only slug,slug] [--force]
//   (no flags)  every trek whose MP3 is missing or whose script changed since it was made (--missing: the same)
//   --estimate  list what would be made and why, with the characters (credits) and size, without calling the API
//   --only      just these treks, still only if missing or changed
//   --force     remake them even if unchanged
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import { AUDIO_BUDGET_BYTES, AUDIO_FORMAT, audioBytes, audioFile, estimate, generateAudio, mislabelled, planAudio, readManifest } from "../src/lib/audio";
import { loadEnv } from "../src/lib/env";
import { readTrekFiles } from "../src/lib/trek-files";

const MODEL_ID = "eleven_multilingual_v2";
const OUT = path.join(process.cwd(), "public", "audio");
const USAGE = "Usage: pnpm audio [--estimate] [--only slug,slug] [--force]";
const mb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;
const fail = (message: string): never => {
  console.error(message);
  process.exit(1);
};

// A mistyped flag must never turn an estimate into a paid run.
const args = process.argv.slice(2).filter((a) => a !== "--");
const onlyAt = args.indexOf("--only");
const isOnlyValue = (i: number) => onlyAt !== -1 && i === onlyAt + 1;
const unknownArgs = args.filter((a, i) => !["--estimate", "--missing", "--force", "--only"].includes(a) && !isOnlyValue(i));
if (unknownArgs.length > 0) fail(`Unknown argument: ${unknownArgs.join(" ")}. ${USAGE}`);
const only = onlyAt === -1 ? undefined : (args[onlyAt + 1] ?? "").split(",").map((s) => s.trim()).filter(Boolean);
if (only?.length === 0) fail(`--only needs trek slugs, comma-separated. ${USAGE}`);

const scripts = readTrekFiles().flatMap((r) => (r.trek?.audio_script ? [{ slug: r.trek.slug, text: r.trek.audio_script }] : []));
const unknown = (only ?? []).filter((s) => !scripts.some((t) => t.slug === s));
if (unknown.length > 0) fail(`No audio script for: ${unknown.join(", ")}`);

const exists = (slug: string) => existsSync(audioFile(OUT, slug));
const manifest = readManifest(OUT);
const { todo, unchanged } = planAudio(scripts, manifest, { only, force: args.includes("--force"), exists });

for (const s of todo) console.log(`  ${s.slug.padEnd(22)} ${s.reason.padEnd(15)} ${s.text.length} characters`);
if (unchanged.length > 0) console.log(`Unchanged, skipped: ${unchanged.join(", ")}`);
const e0 = estimate(todo);
console.log(`${todo.length} intro(s) to generate, ${e0.chars.toLocaleString("en-IN")} characters, about ${e0.megabytes.toFixed(1)} MB`);
if (args.includes("--estimate") || todo.length === 0) process.exit(0);

const env = loadEnv("audio");
const client = new ElevenLabsClient({ apiKey: env.ELEVENLABS_API_KEY });
mkdirSync(OUT, { recursive: true });

// Status code and ElevenLabs' own error status only: never the request, which carries the key.
const describe = (e: unknown) => {
  const err = e as { statusCode?: number; body?: { detail?: { status?: string } } };
  return err.statusCode ? `HTTP ${err.statusCode}${err.body?.detail?.status ? ` (${err.body.detail.status})` : ""}` : (e as Error).message;
};

// The voice's name goes into the manifest, for the credits. Its ID stays in the env. Reading it costs no credits.
const voice = await client.voices.get(env.ELEVENLABS_VOICE_ID!).catch((e: unknown) => {
  return fail(`Couldn't read the voice's name (${describe(e)}), which the manifest needs for the credits. Check ELEVENLABS_VOICE_ID, and that the key may read voices.`);
});
if (!voice.name) fail("The voice has no name for the credits. Pick another voice.");
const made = { voice: voice.name!, model: MODEL_ID, format: AUDIO_FORMAT };

const stale = mislabelled(manifest, made, todo, exists);
if (stale.length > 0) {
  fail(
    `The manifest says the intros were made with "${manifest!.voice}" (${manifest!.model}, ${manifest!.format}); this run uses "${made.voice}" (${made.model}, ${made.format}). ` +
      `It would leave these mislabelled: ${stale.join(", ")}. Remake every intro with --force, or switch back.`,
  );
}

const speak = async (text: string) => {
  const stream = await client.textToSpeech.convert(env.ELEVENLABS_VOICE_ID!, { text, modelId: MODEL_ID, outputFormat: AUDIO_FORMAT });
  return new Uint8Array(await new Response(stream as ReadableStream).arrayBuffer());
};

const run = await generateAudio(todo, speak, OUT, describe, made);
for (const slug of run.done) console.log(`✓ ${path.basename(audioFile(OUT, slug))}`);
if (run.failed) {
  console.error(`✗ ${run.failed.slug}: ${run.failed.reason}. Stopped; not recorded yet: ${run.remaining.join(", ")}`);
}
const total = audioBytes(OUT);
console.log(`public/audio: ${mb(total)} in total (budget ${mb(AUDIO_BUDGET_BYTES)})`);
if (total > AUDIO_BUDGET_BYTES) fail("Over the size budget: check the format and the script lengths before committing.");
process.exit(run.failed ? 1 : 0);
