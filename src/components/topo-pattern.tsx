// Faint contour lines behind the whole main area, fading out about 60% of the way down. The SVG is a mask
// over the --topo colour, so it's cached once by the browser and tinted by CSS.
export function TopoBackdrop() {
  return (
    <div aria-hidden className="topo-fade no-print pointer-events-none absolute inset-0 -z-10">
      <div className="topo-mask absolute inset-0" />
    </div>
  );
}
