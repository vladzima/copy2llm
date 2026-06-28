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
  return legacyCopy(text, win);
}

function legacyCopy(text: string, win: Window): boolean {
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
