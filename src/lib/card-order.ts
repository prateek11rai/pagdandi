// Cards in the order the search ranked them (relevance plus distance from the group's city), not the model's.
// Cards the search didn't return keep the model's order, after the ranked ones.
export function orderBySearch<T extends { slug: string }>(cards: T[], ranked: string[]): T[] {
  const rank = (slug: string) => (ranked.includes(slug) ? ranked.indexOf(slug) : ranked.length);
  return cards
    .map((card, i) => ({ card, i }))
    .sort((a, b) => rank(a.card.slug) - rank(b.card.slug) || a.i - b.i)
    .map(({ card }) => card);
}

// The slugs of a searchTreks result, in its order.
export function searchRanking(output: unknown): string[] {
  const treks = (output as { treks?: unknown } | null)?.treks;
  return Array.isArray(treks) ? treks.flatMap((t) => (typeof t?.slug === "string" ? [t.slug as string] : [])) : [];
}
