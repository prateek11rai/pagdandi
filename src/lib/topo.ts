// Deterministic topographic contour lines: a few seeded hills, marching squares, chained polylines.

type Pt = [number, number];

function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface TopoOptions {
  width: number;
  height: number;
  seed?: number;
  hills?: number;
  levels?: number;
  cell?: number;
}

export function contourPaths({ width, height, seed = 11, hills = 6, levels = 14, cell = 8 }: TopoOptions): string[] {
  const rand = mulberry32(seed);
  const peaks = Array.from({ length: hills }, () => ({
    x: rand() * width,
    y: rand() * height,
    h: 0.5 + rand(),
    r: (0.18 + rand() * 0.3) * Math.max(width, height),
  }));
  const field = (x: number, y: number) =>
    peaks.reduce((s, p) => s + p.h * Math.exp(-((x - p.x) ** 2 + (y - p.y) ** 2) / (2 * p.r * p.r)), 0) +
    0.08 * Math.sin(x / 90 + y / 140) +
    0.05 * Math.cos(y / 60 - x / 200);

  const cols = Math.ceil(width / cell) + 1;
  const rows = Math.ceil(height / cell) + 1;
  const v: number[][] = [];
  let min = Infinity;
  let max = -Infinity;
  for (let j = 0; j < rows; j++) {
    v[j] = [];
    for (let i = 0; i < cols; i++) {
      const f = field(i * cell, j * cell);
      v[j]![i] = f;
      min = Math.min(min, f);
      max = Math.max(max, f);
    }
  }

  const paths: string[] = [];
  for (let l = 1; l <= levels; l++) {
    const t = min + ((max - min) * l) / (levels + 1);
    paths.push(chain(segments(v, t, cols, rows, cell)));
  }
  return paths.filter(Boolean);
}

function segments(v: number[][], t: number, cols: number, rows: number, cell: number): [Pt, Pt][] {
  const out: [Pt, Pt][] = [];
  const lerp = (a: number, b: number) => (t - a) / (b - a);
  for (let j = 0; j < rows - 1; j++) {
    for (let i = 0; i < cols - 1; i++) {
      const a = v[j]![i]!, b = v[j]![i + 1]!, c = v[j + 1]![i + 1]!, d = v[j + 1]![i]!;
      const x = i * cell, y = j * cell;
      const top: Pt = [x + cell * lerp(a, b), y];
      const right: Pt = [x + cell, y + cell * lerp(b, c)];
      const bottom: Pt = [x + cell * lerp(d, c), y + cell];
      const left: Pt = [x, y + cell * lerp(a, d)];
      const idx = (a > t ? 8 : 0) | (b > t ? 4 : 0) | (c > t ? 2 : 0) | (d > t ? 1 : 0);
      const cases: Record<number, [Pt, Pt][]> = {
        1: [[left, bottom]], 2: [[bottom, right]], 3: [[left, right]], 4: [[top, right]],
        5: [[left, top], [bottom, right]], 6: [[top, bottom]], 7: [[left, top]], 8: [[left, top]],
        9: [[top, bottom]], 10: [[left, bottom], [top, right]], 11: [[top, right]], 12: [[left, right]],
        13: [[bottom, right]], 14: [[left, bottom]],
      };
      out.push(...(cases[idx] ?? []));
    }
  }
  return out;
}

// Join segments that share endpoints into polylines, so each point is written once.
function chain(segs: [Pt, Pt][]): string {
  const key = (p: Pt) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`;
  const ends = new Map<string, number[]>();
  segs.forEach(([p, q], i) => {
    for (const k of [key(p), key(q)]) ends.set(k, [...(ends.get(k) ?? []), i]);
  });
  const used = new Set<number>();
  const fmt = (p: Pt) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`;
  let d = "";
  for (let s = 0; s < segs.length; s++) {
    if (used.has(s)) continue;
    used.add(s);
    const line: Pt[] = [...segs[s]!];
    for (const forward of [true, false]) {
      for (;;) {
        const tip = forward ? line[line.length - 1]! : line[0]!;
        const next = (ends.get(key(tip)) ?? []).find((i) => !used.has(i));
        if (next === undefined) break;
        used.add(next);
        const [p, q] = segs[next]!;
        const other = key(p) === key(tip) ? q : p;
        if (forward) line.push(other);
        else line.unshift(other);
      }
    }
    d += `M${fmt(line[0]!)}` + line.slice(1).map((p) => `L${fmt(p)}`).join("");
  }
  return d;
}

export function topoSvg(opts: TopoOptions): string {
  const paths = contourPaths(opts)
    .map((d, i) => `<path d="${d}" stroke-width="${i % 4 === 3 ? 1.4 : 0.8}"/>`)
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${opts.width} ${opts.height}" fill="none" stroke="#000" stroke-linejoin="round">${paths}</svg>\n`;
}
