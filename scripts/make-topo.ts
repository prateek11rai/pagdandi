// Regenerate public/brand/topo.svg, the contour pattern behind headers (deterministic).
import { writeFileSync } from "node:fs";
import { topoSvg } from "../src/lib/topo";

writeFileSync("public/brand/topo.svg", topoSvg({ width: 1600, height: 900, seed: 11, hills: 7, levels: 16, cell: 10 }));
console.log("wrote public/brand/topo.svg");
