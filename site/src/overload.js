// Overload geometry. Pure, DOM-free; shared by the header, the console stage,
// the social-image generator and the tests. Units are master-wordmark units
// (viewBox 0 0 1044 230), SVG coordinates (y down).

export const GLYPH_SCALE = 0.107021;

// Glyphs k = 0..7, taken verbatim from SUPERER_overload_active.svg.
export const OVERLOAD_REFERENCE = [
  { glyph: "E", x: 1020.8, y: 190.0, rotation: 0.0 },
  { glyph: "R", x: 1152.454, y: 194.098, rotation: 3.563 },
  { glyph: "E", x: 1300.587, y: 208.51, rotation: 7.537 },
  { glyph: "R", x: 1430.59, y: 229.706, rotation: 10.967 },
  { glyph: "E", x: 1575.699, y: 262.806, rotation: 14.704 },
  { glyph: "R", x: 1702.131, y: 299.763, rotation: 17.859 },
  { glyph: "E", x: 1842.38, y: 349.602, rotation: 21.232 },
  { glyph: "R", x: 1963.947, y: 400.328, rotation: 24.037 },
];

export const ROTATION_STEP = 3.43;
export const ROTATION_MAX = 80;
export const ADVANCE_AFTER_E = 131.72; // E -> R, measured along the curve
export const ADVANCE_AFTER_R = 148.84; // R -> E, measured along the curve

const DEG = Math.PI / 180;

/**
 * Positions of the glyphs that follow the canonical SUPERER.
 * @param {number} extraERs number of extra ERs (each ER is two glyphs)
 * @returns {{glyph: "E"|"R", x: number, y: number, rotation: number}[]}
 */
export function overloadGlyphs(extraERs) {
  const n = Math.max(0, Math.floor(extraERs || 0)) * 2;
  const out = [];
  for (let k = 0; k < n; k++) {
    if (k < OVERLOAD_REFERENCE.length) {
      out.push({ ...OVERLOAD_REFERENCE[k] });
      continue;
    }
    const prev = out[k - 1];
    const rotation = Math.min(prev.rotation + ROTATION_STEP, ROTATION_MAX);
    const advance = prev.glyph === "E" ? ADVANCE_AFTER_E : ADVANCE_AFTER_R;
    const phi = ((prev.rotation + rotation) / 2) * DEG;
    out.push({
      glyph: k % 2 === 0 ? "E" : "R",
      x: prev.x + advance * Math.cos(phi),
      y: prev.y + advance * Math.sin(phi),
      rotation,
    });
  }
  return out;
}

/** SVG transform attribute for one overload glyph. */
export function glyphTransform({ x, y, rotation }) {
  return `translate(${x.toFixed(3)},${y.toFixed(3)}) rotate(${rotation.toFixed(3)}) scale(${GLYPH_SCALE},-${GLYPH_SCALE})`;
}

/** Version name for a total ER count: 0 -> SUPER, 1 -> SUPERER, 2 -> SUPERERER... */
export function versionName(totalERs) {
  return "SUPER" + "ER".repeat(Math.max(0, totalERs));
}
