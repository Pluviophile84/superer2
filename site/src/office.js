// SEC.05 Renaming Office: form, card preview, UPGRADE AGAIN, DOWNLOAD, SHARE.
// Fully client-side: nothing is sent or stored anywhere.
import { renameRequest, normalizeName, slugify, MAX_UPGRADES } from "./rename.js";
import { drawCard, cardBlob, loadCardFonts, noticeNumber, formatFiled } from "./card.js";
import { copyText } from "./copy.js";

export function initOffice({ root, siteUrl }) {
  const form = root.querySelector("[data-office-form]");
  const input = root.querySelector("[data-office-input]");
  const submit = root.querySelector("[data-office-submit]");
  const preview = root.querySelector("[data-office-preview]");
  const nojs = root.querySelector("[data-office-nojs]");
  const denied = root.querySelector("[data-office-denied]");
  const actions = root.querySelector("[data-office-actions]");
  const upgradeBtn = root.querySelector("[data-office-upgrade]");
  const downloadBtn = root.querySelector("[data-office-download]");
  const shareBtn = root.querySelector("[data-office-share]");
  const shareStatus = root.querySelector("[data-office-share-status]");
  const status = root.querySelector("[data-office-status]");

  const shareUrl = siteUrl || location.href.split("#")[0];
  const host = siteUrl ? new URL(siteUrl).host : location.host;

  let name = "";
  let upgrades = 0;
  let notice = "";
  let filed = "";
  let current = null; // { result, blob, url }
  let shareTimer = 0;
  let job = 0;

  // The static example card is the no-JS fallback only.
  preview.hidden = true;
  preview.removeAttribute("src");
  nojs.hidden = true;
  form.hidden = false;

  const syncSubmit = () => (submit.disabled = normalizeName(input.value) === "");

  input.addEventListener("input", () => {
    const clean = normalizeName(input.value, { live: true });
    if (clean !== input.value) {
      const caret = input.selectionStart ?? clean.length;
      const lost = input.value.length - clean.length;
      input.value = clean;
      const pos = Math.max(0, Math.min(clean.length, caret - Math.max(0, lost)));
      input.setSelectionRange(pos, pos);
    }
    syncSubmit();
  });
  syncSubmit();

  async function render() {
    const id = ++job;
    const result = renameRequest(name, upgrades);
    if (result.denied) {
      clearCard();
      denied.textContent = result.subline;
      denied.hidden = false;
      status.textContent = result.subline;
      return;
    }
    denied.hidden = true;
    // Fonts are loaded once; nothing is awaited between clearing and drawing,
    // and every card is drawn on its own offscreen canvas, never the preview.
    await loadCardFonts();
    if (id !== job) return;
    const canvas = drawCard(document.createElement("canvas"), { ...result, notice, filed, host });
    const blob = await cardBlob(canvas);
    if (id !== job) return;
    const url = URL.createObjectURL(blob);
    // Decode the new card off-DOM first. The visible preview keeps the old
    // card until the decoded one replaces it in a single src swap.
    const next = new Image();
    next.src = url;
    try {
      await next.decode();
    } catch {
      // Decoding failed or is unsupported: swap anyway, the img decodes it.
    }
    if (id !== job) {
      URL.revokeObjectURL(url);
      return;
    }
    const previous = current;
    current = { result, blob, url };
    preview.src = url;
    // Revoke the old card only after the swap.
    if (previous) URL.revokeObjectURL(previous.url);
    preview.alt = `Renaming notice: ${result.from} shall be known as ${result.to}.`;
    preview.hidden = false;
    actions.hidden = false;
    const capped = upgrades >= MAX_UPGRADES;
    upgradeBtn.disabled = capped;
    upgradeBtn.textContent = capped ? "CONTAINER EXCEEDED" : "UPGRADE AGAIN";
    status.textContent = `Renaming notice ${notice} filed. ${result.from} shall be known as ${result.to}. ${result.subline}`;
  }

  function clearCard() {
    if (current) URL.revokeObjectURL(current.url);
    current = null;
    preview.hidden = true;
    preview.removeAttribute("src");
    actions.hidden = true;
  }

  form.addEventListener("submit", (ev) => {
    ev.preventDefault();
    const value = normalizeName(input.value);
    if (!value) return;
    input.value = value;
    name = value;
    upgrades = 0;
    notice = noticeNumber();
    filed = formatFiled(new Date());
    shareStatus.textContent = "";
    render();
  });

  upgradeBtn.addEventListener("click", () => {
    if (!current || upgrades >= MAX_UPGRADES) return;
    upgrades += 1;
    render();
  });

  const fileName = () => `superer-renaming-${slugify(current.result.to)}.png`;
  const shareText = () =>
    `${current.result.from} HAS BEEN RENAMED ${current.result.to}. INTELLIGENCE UNCHANGED. ADD ER. ${shareUrl}`;

  downloadBtn.addEventListener("click", () => {
    if (!current) return;
    const a = document.createElement("a");
    a.href = current.url;
    a.download = fileName();
    document.body.appendChild(a);
    a.click();
    a.remove();
  });

  shareBtn.addEventListener("click", async () => {
    if (!current) return;
    const text = shareText();
    const file = typeof File === "function" ? new File([current.blob], fileName(), { type: "image/png" }) : null;
    if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], text });
        return;
      } catch (err) {
        if (err && err.name === "AbortError") return;
      }
    }
    const ok = await copyText(text);
    shareStatus.textContent = ok ? "COPIED. ATTACH THE IMAGE." : "";
    clearTimeout(shareTimer);
    shareTimer = setTimeout(() => (shareStatus.textContent = ""), 4000);
  });
}
