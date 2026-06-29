/**
 * Copy text to the clipboard. Tries the async Clipboard API (secure contexts),
 * then falls back to a hidden-textarea `execCommand('copy')`. Returns whether it
 * succeeded so the caller can degrade further (e.g. open the View overlay).
 */
export async function copyText(text: string, win: Window): Promise<boolean> {
  const clip = win.navigator?.clipboard;
  if (clip?.writeText) {
    try {
      await clip.writeText(text);
      return true;
    } catch {
      // Permission denied / insecure context — fall through to the legacy path.
    }
  }
  return copyTextSync(text, win);
}

/**
 * Synchronous clipboard copy via a hidden textarea + `execCommand('copy')`.
 * Unlike the async Clipboard API this runs inline within the click gesture, so
 * it can be called right before `window.open` without losing user activation —
 * and it never raises the clipboard permission prompt that the async write does
 * once focus has moved to the freshly opened tab.
 */
export function copyTextSync(text: string, win: Window): boolean {
  const doc = win.document;
  const ta = doc.createElement("textarea");
  ta.value = text;
  ta.setAttribute("readonly", "");
  ta.style.position = "fixed";
  ta.style.top = "-9999px";
  ta.style.opacity = "0";
  doc.body.appendChild(ta);
  ta.select();
  let ok = false;
  try {
    ok = doc.execCommand("copy");
  } catch {
    ok = false;
  }
  ta.remove();
  return ok;
}
