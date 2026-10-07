// Clipboard with a hidden-textarea fallback.
export async function copyText(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to the legacy path
  }
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.setAttribute("readonly", "");
  ta.setAttribute("aria-hidden", "true");
  ta.className = "visually-hidden";
  document.body.appendChild(ta);
  ta.select();
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  }
  ta.remove();
  return ok;
}

/** Wire every [data-copy-ca] button to the full contract address. */
export function initCopyButtons({ address, status }) {
  const buttons = document.querySelectorAll("[data-copy-ca]");
  buttons.forEach((btn) => {
    if (!address) {
      btn.disabled = true;
      btn.setAttribute("aria-disabled", "true");
      return;
    }
    let timer = 0;
    btn.addEventListener("click", async () => {
      const ok = await copyText(address);
      status.textContent = "";
      // Re-set on the next frame so repeat copies are announced again.
      requestAnimationFrame(() => {
        status.textContent = ok ? "CONTRACT ADDRESS COPIED." : "COPY FAILED. SELECT THE ADDRESS MANUALLY.";
      });
      if (ok) {
        btn.textContent = "COPIED";
        clearTimeout(timer);
        timer = setTimeout(() => (btn.textContent = "COPY"), 1600);
      }
    });
  });
}
