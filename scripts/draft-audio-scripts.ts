// Gemma drafts each trek's audio script from its YAML. Numbers are fact-checked against the trek;
// a draft that fails twice is skipped. Writes audio_script into the YAML, keeping comments.
// Usage: pnpm audio:draft [--only slug,slug] [--force]
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { generateText } from "ai";
import { parse } from "yaml";
import { loadEnv } from "../src/lib/env";
import { checkSentence, userNumbersFrom } from "../src/lib/fact-check";
import { formatSeason } from "../src/lib/format";
import { factsOf } from "../src/lib/trek-facts";
import { readTrekFiles, TREKS_DIR } from "../src/lib/trek-files";
import { wordCount, type Trek } from "../src/lib/trek-schema";
import { chatModel } from "../src/mastra/model";

loadEnv("model");

const onlyArg = process.argv.find((a, i) => process.argv[i - 1] === "--only");
const only = onlyArg ? new Set(onlyArg.split(",")) : null;
const force = process.argv.includes("--force");

function brief(t: Trek): string {
  const lines = [
    `Trek: ${t.name}, ${t.state}${t.area ? ` (${t.area})` : ""}`,
    t.highest_point.altitude_m !== null ? `Highest point: ${t.highest_point.name}, ${t.highest_point.altitude_m} metres` : `Highest point: ${t.highest_point.name}`,
    t.days !== null ? `Length: ${t.days === 1 ? "a day hike" : `${t.days} days`}` : null,
    t.season_months.length ? `Season: ${formatSeason(t.season_months)}` : null,
    t.getting_there.road_head ? `Starts from: ${t.getting_there.road_head}` : null,
    `What you'll see:\n- ${t.highlights.join("\n- ")}`,
  ];
  return lines.filter(Boolean).join("\n");
}

// Openings that sound canned when a visitor plays several intros in a row.
const BANNED_OPENINGS = /^(imagine|picture|are you|get ready|ready to|welcome|nestled|have you|if you)/i;

const STOPWORDS = new Set(["the", "a", "an", "of", "from", "to", "on", "at", "in", "is", "you", "your", "this", "that", "with", "and"]);

// The first three content words: "The view from the top of Agasthyarkoodam" -> "view top agasthyarkoodam".
export function openingKey(script: string): string {
  const words = script.toLowerCase().replace(/[^a-z\s'-]/g, " ").split(/\s+/).filter((w) => w && !STOPWORDS.has(w));
  return words.slice(0, 3).join(" ");
}

export function styleProblem(script: string, usedOpenings: Set<string>): string | null {
  if (script.includes("?")) return "contains a question";
  if (BANNED_OPENINGS.test(script)) return "canned opening";
  if (/imagine yourself/i.test(script)) return "says 'imagine yourself'";
  if (usedOpenings.has(openingKey(script))) return "same opening as another trek";
  if (!script.endsWith(CLOSING)) return "missing the closing line";
  if (wordCount(script) < 120) return "too short";
  return null;
}

const CLOSING = "The day-by-day plan and permits are on the Pagdandi page.";

async function draft(t: Trek, usedOpenings: Set<string>): Promise<{ script: string | null; tries: number; last: string }> {
  const facts = factsOf(t);
  let last = "";
  for (let attempt = 1; attempt <= 4; attempt++) {
    // Lead with the signature highlight; if that keeps colliding, try the next one.
    const lead = t.highlights[attempt <= 2 ? 0 : 1 % t.highlights.length]!;
    const { text } = await generateText({
      model: chatModel(),
      temperature: 0.7,
      maxOutputTokens: 400,
      providerOptions: { ollama: { reasoningEffort: "none" } },
      prompt: `Write a spoken introduction of 140 to 180 words to this Indian trek, to be read aloud by a narrator. It must be at least 140 words.
Your first sentence is about this, stated plainly and naming the place: "${lead}"
Then say why the trek is worth doing and what you will see. Warm, plain spoken English, second person, no lists, no headings.
No questions anywhere. Do not begin with "Imagine", "Picture", "Are you ready", "Get ready", "Welcome" or "Nestled", and never say "imagine yourself".
Use only the facts below. Do not add other names, numbers, legends, history or claims. You may leave facts out. Do not mention prices.
End with exactly: "${CLOSING}"

${brief(t)}`,
    });
    const script = text.replace(/\s+/g, " ").trim();
    // Numbers quoted in the brief itself (a highlight's "each above 4,000 m") are sourced text, so they may be repeated.
    const checked = checkSentence(script, { treks: [facts], contextSlugs: [t.slug], userNumbers: userNumbersFrom(brief(t)) });
    // Bare numbers ("600 kinds") have no unit for the fact-check, so they must appear in the trek's data as written.
    const data = JSON.stringify({ ...t, audio_script: null });
    const stray = (script.match(/\d[\d,.]*\d|\d/g) ?? []).filter((n) => !data.includes(n) && !data.includes(n.replace(/,/g, "")));
    const problem =
      checked.replaced > 0
        ? `a number didn't match the data (${checked.text.match(/.{0,30}\(see the card\)/)?.[0] ?? "?"})`
        : stray.length > 0
          ? `a number isn't in the trek's data (${stray.join(", ")})`
          : wordCount(script) > 230
            ? "too long"
            : styleProblem(script, usedOpenings);
    last = problem ?? "";
    if (!problem) return { script, tries: attempt, last };
  }
  return { script: null, tries: 4, last };
}

// Replace only the audio_script entry with a folded block, so the rest of the file (and its comments) is untouched.
export function withAudioScript(yamlText: string, script: string): string {
  const lines = yamlText.split("\n");
  const start = lines.findIndex((l) => /^audio_script:/.test(l));
  if (start < 0) throw new Error("no audio_script key");
  let end = start + 1;
  while (end < lines.length && (/^\s/.test(lines[end]!) || lines[end] === "")) end++;
  const wrapped: string[] = [];
  let line = "";
  for (const word of script.split(" ")) {
    if (line && (line + " " + word).length > 96) {
      wrapped.push(`  ${line}`);
      line = word;
    } else line = line ? `${line} ${word}` : word;
  }
  if (line) wrapped.push(`  ${line}`);
  const next = [...lines.slice(0, start), "audio_script: >-", ...wrapped, ...lines.slice(end)].join("\n");
  if ((parse(next) as { audio_script: string }).audio_script !== script) throw new Error("audio_script did not round-trip");
  return next;
}

const treks = readTrekFiles().flatMap((r) => (r.trek ? [r.trek] : []));
// Openings already in use by scripts we are keeping, so a new draft can't repeat them.
const usedOpenings = new Set(
  treks.filter((t) => t.audio_script && !force && !(only && only.has(t.slug))).map((t) => openingKey(t.audio_script!)),
);
for (const t of treks) {
  if (only && !only.has(t.slug)) continue;
  if (t.audio_script && !force) continue;
  const started = performance.now();
  const { script, tries, last } = await draft(t, usedOpenings);
  const secs = ((performance.now() - started) / 1000).toFixed(1);
  if (!script) {
    console.log(`✗ ${t.slug}: no draft passed after ${tries} tries (last problem: ${last}) (${secs}s)`);
    continue;
  }
  usedOpenings.add(openingKey(script));
  const file = path.join(TREKS_DIR, `${t.slug}.yaml`);
  writeFileSync(file, withAudioScript(readFileSync(file, "utf8"), script));
  console.log(`✓ ${t.slug}: ${wordCount(script)} words, ${tries} ${tries === 1 ? "try" : "tries"} (${secs}s)`);
}
