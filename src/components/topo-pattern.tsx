// Faint contour lines behind a hero or section header. The SVG is a mask over the theme's
// --topo colour, so it follows light and dark mode and is cached once by the browser.
export function TopoBackdrop({ className = "" }: { className?: string }) {
  return <div aria-hidden className={`topo-mask no-print pointer-events-none absolute inset-0 -z-10 ${className}`} />;
}
