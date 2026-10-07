// Renaming notice card: 1200 x 1200 canvas, exported as PNG.
// Added ERs are drawn with the brand glyph outlines (Path2D), never the font.
import { PATHS, INK, HOT_ER, WHITE, MASTER_LAYOUT, MASTER_BASELINE } from "./glyphs.js";
import { overloadGlyphs, GLYPH_SCALE } from "./overload.js";

export const CARD_SIZE = 1200;
const M = 72; // margin
const CONTENT = CARD_SIZE - 2 * M;
const MUTE = "#6B6B6B";
const SANS = '"IBM Plex Sans", system-ui, sans-serif';
const MONO = '"IBM Plex Mono", ui-monospace, monospace';
const MAX_SIZE = 150;
const MIN_SIZE = 64;

// Brand glyph metrics in font units (from the master wordmark).
const CAP = 1493;
const E_TO_R = (871.937 - 740.198) / GLYPH_SCALE; // E origin -> R origin
const R_RIGHT = 1382; // right edge of the R outline
const MASTER_E = 740.198; // master-unit x of the canonical E

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
export const formatFiled = (d) =>
  `${String(d.getDate()).padStart(2, "0")} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;

export function noticeNumber() {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return String(a[0] % 100000).padStart(5, "0");
}

let paths = null;
const glyphPath = (g) => {
  if (!paths) paths = Object.fromEntries(Object.entries(PATHS).map(([k, d]) => [k, new Path2D(d)]));
  return paths[g];
};

/** Make sure the first card never renders in a fallback font. Loaded once. */
let fontsReady = null;
export function loadCardFonts() {
  if (!fontsReady) {
    fontsReady =
      document.fonts && document.fonts.load
        ? Promise.all([
            document.fonts.load(`700 100px ${SANS}`),
            document.fonts.load(`400 24px ${MONO}`),
            document.fonts.load(`600 24px ${MONO}`),
          ]).catch(() => {})
        : Promise.resolve();
  }
  return fontsReady;
}

function brandGlyph(ctx, glyph, x, y, rotation, scale, fill) {
  ctx.save();
  ctx.translate(x, y);
  if (rotation) ctx.rotate((rotation * Math.PI) / 180);
  ctx.scale(scale, -scale);
  ctx.fillStyle = fill;
  ctx.fill(glyphPath(glyph));
  ctx.restore();
}

const capHeight = (ctx, size) => {
  ctx.font = `700 ${size}px ${SANS}`;
  const m = ctx.measureText("H");
  return m.actualBoundingBoxAscent || size * 0.698;
};

/** Largest size (MIN..MAX) at which `measure(size)` fits the content width. */
function fit(measure) {
  let size = MAX_SIZE;
  while (size > MIN_SIZE && measure(size) > CONTENT) size -= 2;
  return Math.max(size, MIN_SIZE);
}

function wrapMono(ctx, text, maxWidth) {
  const words = text.split(" ");
  const lines = [];
  let line = "";
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (line && ctx.measureText(next).width > maxWidth) {
      lines.push(line);
      line = w;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function rule(ctx, y) {
  ctx.fillStyle = INK;
  ctx.fillRect(M, y, CONTENT, 2);
}

/**
 * Draw a renaming notice.
 * @param {HTMLCanvasElement} canvas
 * @param {{from: string, to: string, erAdded: number, subline: string,
 *          notice: string, filed: string, host?: string}} n
 */
export function drawCard(canvas, n) {
  canvas.width = CARD_SIZE;
  canvas.height = CARD_SIZE;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = WHITE;
  ctx.fillRect(0, 0, CARD_SIZE, CARD_SIZE);
  ctx.textBaseline = "alphabetic";

  // Masthead
  ctx.fillStyle = INK;
  ctx.font = `600 26px ${MONO}`;
  ctx.textAlign = "left";
  ctx.fillText("SUPERER RENAMING OFFICE", M, M + 26);
  ctx.textAlign = "right";
  ctx.fillText(`NOTICE NO. ${n.notice}`, CARD_SIZE - M, M + 26);
  ctx.textAlign = "left";
  ctx.font = `400 22px ${MONO}`;
  ctx.fillStyle = MUTE;
  ctx.fillText(`FILED ${n.filed}`, M, M + 66);
  rule(ctx, 176);

  // The name, before and after. Only the trailing added ERs are brand glyphs.
  const fontPart = n.to.slice(0, n.to.length - 2 * n.erAdded);
  const erWidth = (size) => (capHeight(ctx, size) / CAP) * (E_TO_R + R_RIGHT);
  const sizeFrom = fit((size) => {
    ctx.font = `700 ${size}px ${SANS}`;
    return ctx.measureText(n.from).width;
  });
  const sizeTo = fit((size) => {
    ctx.font = `700 ${size}px ${SANS}`;
    return ctx.measureText(fontPart).width + erWidth(size);
  });
  const size = Math.min(sizeFrom, sizeTo);
  const cap = capHeight(ctx, size);

  ctx.fillStyle = INK;
  ctx.font = `400 24px ${MONO}`;
  ctx.fillText("EFFECTIVE IMMEDIATELY,", M, 250);

  const fromBase = 250 + 56 + cap;
  ctx.font = `700 ${size}px ${SANS}`;
  ctx.fillText(n.from, M, fromBase);

  const knownBase = fromBase + 84;
  ctx.font = `400 24px ${MONO}`;
  ctx.fillText("SHALL BE KNOWN AS", M, knownBase);

  const toBase = knownBase + 56 + cap;
  ctx.font = `700 ${size}px ${SANS}`;
  ctx.fillText(fontPart, M, toBase);
  const endX = M + ctx.measureText(fontPart).width;
  const s = cap / CAP;

  // First added ER sits on the baseline right after the word.
  brandGlyph(ctx, "E", endX, toBase, 0, s, HOT_ER);
  brandGlyph(ctx, "R", endX + E_TO_R * s, toBase, 0, s, HOT_ER);

  // Further ERs follow the shared overload curve, anchored so the first
  // added E plays the canonical E of the master wordmark.
  const m = s / GLYPH_SCALE; // card px per master unit
  const extra = overloadGlyphs(Math.max(0, n.erAdded - 1));

  // Footer block
  rule(ctx, 860);
  ctx.fillStyle = INK;
  ctx.font = `600 24px ${MONO}`;
  let y = 908;
  for (const line of wrapMono(ctx, n.subline, CONTENT)) {
    ctx.fillText(line, M, y);
    y += 36;
  }
  if (!n.subline.includes("INTELLIGENCE: UNCHANGED")) {
    ctx.font = `400 24px ${MONO}`;
    ctx.fillText("INTELLIGENCE: UNCHANGED.", M, y);
  }

  // Small master wordmark, ink + Hot ER, from the brand outlines.
  const k = 0.23;
  const wmBase = 1074;
  for (const g of MASTER_LAYOUT) {
    brandGlyph(ctx, g.glyph, M + (g.x - 24) * k, wmBase, 0, GLYPH_SCALE * k, g.er ? HOT_ER : INK);
  }
  ctx.fillStyle = INK;
  ctx.font = `400 22px ${MONO}`;
  const sig = n.host ? `$SUPERER · ${n.host}` : "$SUPERER";
  ctx.fillText(sig, M + 1000 * k + 28, wmBase);

  ctx.fillStyle = MUTE;
  ctx.font = `400 16px ${MONO}`;
  ctx.fillText("NOT A GOVERNMENT DOCUMENT. NOTHING HERE IS.", M, CARD_SIZE - M);

  // Overflowing ERs go last: they are allowed to bleed off the card.
  for (const g of extra) {
    brandGlyph(
      ctx,
      g.glyph,
      endX + (g.x - MASTER_E) * m,
      toBase + (g.y - MASTER_BASELINE) * m,
      g.rotation,
      s,
      HOT_ER,
    );
  }
  return canvas;
}

export const cardBlob = (canvas) =>
  new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("PNG export failed"))), "image/png"),
  );
