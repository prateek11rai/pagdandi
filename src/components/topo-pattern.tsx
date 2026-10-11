// Faint contour lines behind the main area, fading out about 60% of the way down. Capped at 1.5 screens,
// so the lines keep the same weight on long pages. The SVG is a mask over the --topo colour.
export function TopoBackdrop() {
  return (
    <div aria-hidden className="topo-fade no-print pointer-events-none absolute inset-x-0 top-0 -z-10 h-full max-h-[150dvh]">
      <div className="topo-mask absolute inset-0" />
    </div>
  );
}
