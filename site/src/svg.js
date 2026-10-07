// Small helpers for building ER glyphs inside an existing wordmark <svg>.
import { PATHS } from "./glyphs.js";
import { glyphTransform } from "./overload.js";

const NS = "http://www.w3.org/2000/svg";

/** One ER glyph: <g class="er-glyph"><path transform=…/></g>. The wrapper
 *  carries the CSS entrance animation so the path keeps its exact transform. */
export function makeGlyph(glyph, transform, fill, animate) {
  const g = document.createElementNS(NS, "g");
  g.setAttribute("class", animate ? "er-glyph is-new" : "er-glyph");
  const path = document.createElementNS(NS, "path");
  path.setAttribute("d", PATHS[glyph]);
  path.setAttribute("fill", fill);
  path.setAttribute("transform", transform);
  g.appendChild(path);
  return g;
}

/**
 * Sync a <g> container to an ordered list of glyph specs, appending or
 * removing from the end only, so existing glyphs never re-animate.
 * @param {SVGGElement} group
 * @param {{glyph: string, transform: string}[]} specs
 */
export function syncGlyphs(group, specs, fill, animate) {
  while (group.childElementCount > specs.length) group.lastElementChild.remove();
  for (let i = group.childElementCount; i < specs.length; i++) {
    group.appendChild(makeGlyph(specs[i].glyph, specs[i].transform, fill, animate));
  }
}

export const overloadSpecs = (glyphs) =>
  glyphs.map((g) => ({ glyph: g.glyph, transform: glyphTransform(g) }));
