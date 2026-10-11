// The guide's instructions stay on the server. A sentence that copies eight or more words in a row from them
// is replaced before it leaves, whatever the model was talked into.
export const RUN = 8;
export const LEAK_REPLY = "I can't share my instructions, but I can help plan a trek in India.";

export const words = (s: string) => s.toLowerCase().match(/[a-z0-9"'-]+/g) ?? [];

// Every eight-word run in the instructions, except rules 5 and 6 (the cost and safety sentences the guide is told
// to say) and the line with today's date.
export function instructionRuns(instructions: string): Set<string> {
  const runs = new Set<string>();
  for (const line of instructions.split("\n")) {
    if (/^(5|6)\./.test(line) || line.startsWith("Today is")) continue;
    const w = words(line);
    for (let i = 0; i + RUN <= w.length; i++) runs.add(w.slice(i, i + RUN).join(" "));
  }
  return runs;
}

// `before` is the last words already sent, so a run split across a sentence break is caught too.
export function copiesInstructions(before: string[], sentence: string, runs: Set<string>): boolean {
  const w = [...before.slice(-(RUN - 1)), ...words(sentence)];
  for (let i = 0; i + RUN <= w.length; i++) if (runs.has(w.slice(i, i + RUN).join(" "))) return true;
  return false;
}
