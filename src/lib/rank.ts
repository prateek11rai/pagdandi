// Reciprocal rank fusion: each list votes 1 / (k + rank) for its items (rank starts at 1).
export function rrf(lists: readonly (readonly string[])[], k = 60): { id: string; score: number }[] {
  const scores = new Map<string, number>();
  for (const list of lists) {
    list.forEach((id, i) => scores.set(id, (scores.get(id) ?? 0) + 1 / (k + i + 1)));
  }
  return [...scores.entries()]
    .map(([id, score]) => ({ id, score }))
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
}
