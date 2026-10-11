// The three treks under "Check out some treks": ones with an audio intro first, each from a different region.
const PREFERRED = ["kedarkantha", "kalsubai", "sandakphu", "nongriat-root-bridges", "kudremukh", "valley-of-flowers"];

export function pickFeatured<T extends { slug: string; region: string; audioUrl: string | null }>(cards: T[], n = 3): T[] {
  const rank = (slug: string) => (PREFERRED.includes(slug) ? PREFERRED.indexOf(slug) : PREFERRED.length);
  const ordered = [...cards].sort((a, b) => rank(a.slug) - rank(b.slug));
  const out: T[] = [];
  const regions = new Set<string>();
  for (const withAudio of [true, false]) {
    for (const c of ordered) {
      if (out.length === n) return out;
      if (Boolean(c.audioUrl) !== withAudio || regions.has(c.region)) continue;
      out.push(c);
      regions.add(c.region);
    }
  }
  return out;
}
