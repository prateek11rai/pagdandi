// Gemma drafts each trek's audio script from its YAML. Numbers are fact-checked against the trek;
// a draft that fails twice is skipped. Writes audio_script into the YAML, keeping comments.
// Usage: pnpm audio:draft [--only slug,slug] [--force]
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { generateText } from "ai";
import { parse } from "yaml";
import { loadEnv } from "../src/lib/env";
import { checkSentence } from "../src/lib/fact-check";
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

async function draft(t: Trek): Promise<string | null> {
  const facts = factsOf(t);
  for (let attempt = 0; attempt < 2; attempt++) {
    const { text } = await generateText({
      model: chatModel(),
      temperature: 0.6,
      maxOutputTokens: 400,
      providerOptions: { ollama: { reasoningEffort: "none" } },
      prompt: `Write a short spoken introduction (150 to 200 words) to this Indian trek, to be read aloud by a narrator.
Say why the trek is worth doing and what you will see along the way. Warm, plain spoken English, second person, no lists, no headings.
Use only the facts below. Do not add any other names, numbers, legends, history or claims. You may leave facts out.
Do not mention prices or budgets. End with: "The day-by-day plan and permits are on the Pagdandi page."

${brief(t)}`,
    });
    const script = text.replace(/\s+/g, " ").trim();
    const checked = checkSentence(script, { treks: [facts], contextSlugs: [t.slug], userNumbers: [] });
    if (checked.replaced === 0 && wordCount(script) <= 230) return script;
  }
  return null;
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
for (const t of treks) {
  if (only && !only.has(t.slug)) continue;
  if (t.audio_script && !force) continue;
  const started = performance.now();
  const script = await draft(t);
  const secs = ((performance.now() - started) / 1000).toFixed(1);
  if (!script) {
    console.log(`✗ ${t.slug}: no draft passed the fact-check (${secs}s)`);
    continue;
  }
  const file = path.join(TREKS_DIR, `${t.slug}.yaml`);
  writeFileSync(file, withAudioScript(readFileSync(file, "utf8"), script));
  console.log(`✓ ${t.slug}: ${wordCount(script)} words (${secs}s)`);
}
