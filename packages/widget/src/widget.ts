import { type ExtractResult, extract } from "copy2llm-core";
import { copyText } from "./clipboard";
import { isPublicUrl, type LlmTarget, llmUrl } from "./links";
import {
  type Action,
  ALL_ACTIONS,
  DEFAULTS,
  type WidgetOptions,
} from "./options";
import { css, resolveTokens } from "./styles";
import {
  type ResolvedTheme,
  resolveTheme,
  resolveThemeSignal,
  watchTheme,
} from "./theme";

export interface WidgetHandle {
  destroy(): void;
}

const HOST_ATTR = "data-copy2llm";
const HANDLE_KEY = "__c2lHandle";
const TOAST_MS = 2000;
const MSG = {
  copied: "Copied ✓",
  failed: "Couldn’t extract this page",
  paste: "Copied — paste into the chat",
};

const MENU_LABELS: Record<Action, string> = {
  copy: DEFAULTS.label,
  view: "View as Markdown",
  chatgpt: "Open in ChatGPT",
  claude: "Open in Claude",
};

// Monoline action glyphs (Phosphor) + the ChatGPT/Claude brand marks, drawn in
// `currentColor` so they inherit the resolved theme. Kept inline to avoid a
// network request and to survive Shadow-DOM isolation.
const ICONS: Record<Action, string> = {
  copy: '<svg class="c2l-ic" viewBox="0 0 256 256" aria-hidden="true"><path d="M216,32H88a8,8,0,0,0-8,8V80H40a8,8,0,0,0-8,8V216a8,8,0,0,0,8,8H168a8,8,0,0,0,8-8V176h40a8,8,0,0,0,8-8V40A8,8,0,0,0,216,32ZM160,208H48V96H160Zm48-48H176V88a8,8,0,0,0-8-8H96V48H208Z"/></svg>',
  view: '<svg class="c2l-ic" viewBox="0 0 256 256" aria-hidden="true"><path d="M86.75,44.3,33.48,128l53.27,83.7a8,8,0,0,1-2.46,11.05A7.91,7.91,0,0,1,80,224a8,8,0,0,1-6.76-3.71l-56-88a8,8,0,0,1,0-8.59l56-88a8,8,0,1,1,13.5,8.59Zm152,79.41-56-88a8,8,0,1,0-13.5,8.59L222.52,128l-53.27,83.7a8,8,0,0,0,2.46,11.05A7.91,7.91,0,0,0,176,224a8,8,0,0,0,6.76-3.71l56-88A8,8,0,0,0,238.75,123.71Z"/></svg>',
  chatgpt:
    '<svg class="c2l-ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z"/></svg>',
  claude:
    '<svg class="c2l-ic" viewBox="0 0 24 24" aria-hidden="true"><path d="m4.7144 15.9555 4.7174-2.6471.079-.2307-.079-.1275h-.2307l-.7893-.0486-2.6956-.0729-2.3375-.0971-2.2646-.1214-.5707-.1215-.5343-.7042.0546-.3522.4797-.3218.686.0608 1.5179.1032 2.2767.1578 1.6514.0972 2.4468.255h.3886l.0546-.1579-.1336-.0971-.1032-.0972L6.973 9.8356l-2.55-1.6879-1.3356-.9714-.7225-.4918-.3643-.4614-.1578-1.0078.6557-.7225.8803.0607.2246.0607.8925.686 1.9064 1.4754 2.4893 1.8336.3643.3035.1457-.1032.0182-.0728-.164-.2733-1.3539-2.4467-1.445-2.4893-.6435-1.032-.17-.6194c-.0607-.255-.1032-.4674-.1032-.7285L6.287.1335 6.6997 0l.9957.1336.419.3642.6192 1.4147 1.0018 2.2282 1.5543 3.0296.4553.8985.2429.8318.091.255h.1579v-.1457l.1275-1.706.2368-2.0947.2307-2.6957.0789-.7589.3764-.9107.7468-.4918.5828.2793.4797.686-.0668.4433-.2853 1.8517-.5586 2.9021-.3643 1.9429h.2125l.2429-.2429.9835-1.3053 1.6514-2.0643.7286-.8196.85-.9046.5464-.4311h1.0321l.759 1.1293-.34 1.1657-1.0625 1.3478-.8804 1.1414-1.2628 1.7-.7893 1.36.0729.1093.1882-.0183 2.8535-.607 1.5421-.2794 1.8396-.3157.8318.3886.091.3946-.3278.8075-1.967.4857-2.3072.4614-3.4364.8136-.0425.0304.0486.0607 1.5482.1457.6618.0364h1.621l3.0175.2247.7892.522.4736.6376-.079.4857-1.2142.6193-1.6393-.3886-3.825-.9107-1.3113-.3279h-.1822v.1093l1.0929 1.0686 2.0035 1.8092 2.5075 2.3314.1275.5768-.3218.4554-.34-.0486-2.2039-1.6575-.85-.7468-1.9246-1.621h-.1275v.17l.4432.6496 2.3436 3.5214.1214 1.0807-.17.3521-.6071.2125-.6679-.1214-1.3721-1.9246L14.38 17.959l-1.1414-1.9428-.1397.079-.674 7.2552-.3156.3703-.7286.2793-.6071-.4614-.3218-.7468.3218-1.4753.3886-1.9246.3157-1.53.2853-1.9004.17-.6314-.0121-.0425-.1397.0182-1.4328 1.9672-2.1796 2.9446-1.7243 1.8456-.4128.164-.7164-.3704.0667-.6618.4008-.5889 2.386-3.0357 1.4389-1.882.929-1.0868-.0062-.1579h-.0546l-6.3385 4.1164-1.1293.1457-.4857-.4554.0608-.7467.2307-.2429 1.9064-1.3114Z"/></svg>',
};
const CARET_ICON =
  '<svg class="c2l-ic" viewBox="0 0 256 256" aria-hidden="true"><path d="M213.66,101.66l-80,80a8,8,0,0,1-11.32,0l-80-80A8,8,0,0,1,53.66,90.34L128,164.69l74.34-74.35a8,8,0,0,1,11.32,11.32Z"/></svg>';
const EXT_ICON =
  '<svg class="c2l-ext" viewBox="0 0 256 256" aria-hidden="true"><path d="M200,64V168a8,8,0,0,1-16,0V83.31L69.66,197.66a8,8,0,0,1-11.32-11.32L172.69,72H88a8,8,0,0,1,0-16H192A8,8,0,0,1,200,64Z"/></svg>';
// Shown in the primary button after a successful copy (replaces the side toast).
const CHECK_ICON =
  '<svg class="c2l-ic" viewBox="0 0 256 256" aria-hidden="true"><path d="M229.66,77.66l-128,128a8,8,0,0,1-11.32,0l-56-56a8,8,0,0,1,11.32-11.32L96,188.69,218.34,66.34a8,8,0,0,1,11.32,11.32Z"/></svg>';
const COPIED_LABEL = "Copied";
const COPIED_MS = 1400;
// `auto` reveal: poll for a confident theme signal for up to this many frames
// (~0.5s) before falling back to prefers-color-scheme, so a late-painting host
// background can't flash a wrong-theme button.
const REVEAL_MAX_FRAMES = 30;
const EXTERNAL = new Set<Action>(["chatgpt", "claude"]);

/** Parse a trusted inline-SVG string into an element (Shadow-DOM safe). */
function svgEl(doc: Document, markup: string): Element | null {
  const tpl = doc.createElement("template");
  tpl.innerHTML = markup;
  return tpl.content.firstElementChild;
}
function appendIcon(parent: Element, doc: Document, markup: string): void {
  const icon = svgEl(doc, markup);
  if (icon) {
    parent.appendChild(icon);
  }
}
function prependIcon(parent: Element, doc: Document, markup: string): void {
  const icon = svgEl(doc, markup);
  if (icon) {
    parent.prepend(icon);
  }
}

/** Build one menu row: leading glyph, label, and a trailing arrow for deep links. */
function buildMenuItem(
  doc: Document,
  action: Action,
  label: string,
  onClick: () => void
): HTMLButtonElement {
  const item = doc.createElement("button");
  item.className = "menuitem";
  item.type = "button";
  item.setAttribute("role", "menuitem");
  item.dataset.action = action;
  appendIcon(item, doc, ICONS[action]);
  const itemLabel = doc.createElement("span");
  itemLabel.className = "c2l-label";
  itemLabel.textContent = label;
  item.appendChild(itemLabel);
  if (EXTERNAL.has(action)) {
    appendIcon(item, doc, EXT_ICON);
  }
  item.addEventListener("click", onClick);
  return item;
}

// Stash the handle on the host element for idempotent re-mounts.
type WithHandle = HTMLElement & { [HANDLE_KEY]?: WidgetHandle };

interface State {
  copiedTimer?: number;
  currentMarkdown: string;
  overlayEl: HTMLElement | null;
  prevFocus: Element | null;
  toastTimer?: number;
}

/**
 * Mount the Copy-to-LLM button into `target` (default `document.body`). Extraction
 * is lazy — it reads the live DOM on each click, so it stays correct in SPAs.
 * Returns a handle whose `destroy()` removes the widget and all of its listeners.
 */
export function mount(
  options: WidgetOptions = {},
  target?: Element
): WidgetHandle {
  const mountTarget = target ?? document.body;
  const doc = mountTarget.ownerDocument;
  const win = doc.defaultView ?? (globalThis as unknown as Window);

  // Idempotency: one widget per target.
  const existing = mountTarget.querySelector(
    `:scope > [${HOST_ATTR}]`
  ) as WithHandle | null;
  if (existing?.[HANDLE_KEY]) {
    // Another owner already mounted here — hand back an inert handle so a second
    // caller's destroy() can't tear down the first widget.
    return {
      destroy() {
        // no-op: this target is owned by an earlier mount()
      },
    };
  }

  const theme = options.theme ?? DEFAULTS.theme;
  const items: Action[] =
    options.items && options.items.length > 0
      ? options.items
      : [...ALL_ACTIONS];
  const labels: Record<Action, string> = {
    ...MENU_LABELS,
    copy: options.label ?? DEFAULTS.label,
  };

  // Mutable state in one object so the hoisted helpers below mutate fields
  // rather than reassign `let`s (avoids TDZ and keeps the linter happy).
  const state: State = {
    overlayEl: null,
    prevFocus: null,
    currentMarkdown: "",
  };

  // --- build the shadow tree -------------------------------------------------
  const hostEl = doc.createElement("div") as WithHandle;
  hostEl.setAttribute(HOST_ATTR, "");
  const shadow = hostEl.attachShadow({ mode: "open" });

  const styleEl = doc.createElement("style");
  const rootEl = doc.createElement("div");
  rootEl.className = "root";
  rootEl.innerHTML =
    '<div class="box"><div class="split">' +
    '<button class="btn primary" type="button"></button>' +
    "</div>" +
    '<div class="toast" role="status" aria-live="polite" hidden></div>' +
    "</div>";
  shadow.append(styleEl, rootEl);

  const box = rootEl.querySelector(".box") as HTMLElement;
  const split = rootEl.querySelector(".split") as HTMLElement;
  const toastEl = rootEl.querySelector(".toast") as HTMLElement;
  const primary = rootEl.querySelector(".primary") as HTMLButtonElement;

  const primaryAction = items[0];
  // Label lives in its own span so the copy-confirmation can swap just the text
  // (and animate it) without disturbing the icon. `primary.textContent` still
  // equals the label — an SVG node contributes no text.
  const primaryLabel = doc.createElement("span");
  primaryLabel.className = "c2l-label";
  primaryLabel.textContent = labels[primaryAction];
  primary.appendChild(primaryLabel);
  prependIcon(primary, doc, ICONS[primaryAction]);
  primary.addEventListener("click", () => {
    closeMenu();
    runAction(primaryAction).catch(() => undefined);
  });

  const menuActions = items.slice(1);
  let menuEl: HTMLElement | null = null;
  let caret: HTMLButtonElement | null = null;

  if (menuActions.length === 0) {
    split.classList.add("single");
  } else {
    caret = doc.createElement("button");
    caret.className = "btn caret";
    caret.type = "button";
    appendIcon(caret, doc, CARET_ICON);
    caret.setAttribute("aria-haspopup", "menu");
    caret.setAttribute("aria-expanded", "false");
    caret.setAttribute("aria-label", "More actions");
    caret.addEventListener("click", toggleMenu);
    caret.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        openMenu();
      }
    });
    split.appendChild(caret);

    menuEl = doc.createElement("div");
    menuEl.className = "menu";
    menuEl.setAttribute("role", "menu");
    menuEl.hidden = true;
    for (const action of menuActions) {
      const item = buildMenuItem(doc, action, labels[action], () => {
        closeMenu();
        runAction(action).catch(() => undefined);
      });
      menuEl.appendChild(item);
    }
    menuEl.addEventListener("keydown", onMenuKeydown);
    box.insertBefore(menuEl, toastEl);
  }

  // --- theme -----------------------------------------------------------------
  mountTarget.appendChild(hostEl);
  applyTheme(resolveTheme(theme, hostEl, win));
  const stopWatch = watchTheme(theme, hostEl, win, applyTheme);

  // Reveal-gating: the button mounts invisible (opacity 0, see styles.ts) and
  // fades in only once `auto` has a CONFIDENT theme signal — an opaque
  // background behind the button or an explicit color-scheme. A page that
  // paints its background a few frames after our snippet mounts (Framer/SPA
  // hydration) would otherwise resolve to prefers-color-scheme and flash a
  // white button before correcting. Poll across frames; after a budget, fall
  // back so we never stay hidden. Pinned theme / no rAF (SSR, tests) → reveal now.
  const reveal = () => rootEl.classList.add("c2l-in");
  const raf =
    typeof win.requestAnimationFrame === "function"
      ? win.requestAnimationFrame.bind(win)
      : null;
  if (theme !== "auto" || !raf) {
    reveal();
  } else {
    let frames = 0;
    const settle = () => {
      if (!hostEl.isConnected) {
        return; // destroyed mid-poll
      }
      const signal = resolveThemeSignal(hostEl, win);
      if (signal) {
        applyTheme(signal);
        reveal();
      } else if (++frames >= REVEAL_MAX_FRAMES) {
        applyTheme(resolveTheme(theme, hostEl, win));
        reveal();
      } else {
        raf(settle);
      }
    };
    raf(settle);
  }

  // --- document-level listeners (removed on destroy) -------------------------
  const onDocPointer = (e: Event) => {
    if (!menuEl || menuEl.hidden) {
      return;
    }
    const path = (
      e as unknown as { composedPath?: () => EventTarget[] }
    ).composedPath?.();
    if (path?.includes(hostEl) || hostEl.contains(e.target as Node)) {
      return;
    }
    closeMenu();
  };
  const onDocKey = (e: KeyboardEvent) => {
    if (e.key !== "Escape") {
      return;
    }
    if (menuEl && !menuEl.hidden) {
      closeMenu();
      caret?.focus();
    } else if (state.overlayEl && !state.overlayEl.hidden) {
      closeOverlay();
    }
  };
  doc.addEventListener("click", onDocPointer, true);
  doc.addEventListener("keydown", onDocKey);

  const handle: WidgetHandle = { destroy };
  hostEl[HANDLE_KEY] = handle;
  return handle;

  // --- helpers (function declarations: hoisted) ------------------------------
  function applyTheme(resolved: ResolvedTheme): void {
    styleEl.textContent = css(resolveTokens(options, resolved));
  }

  function openMenu(): void {
    if (!(menuEl && caret)) {
      return;
    }
    menuEl.hidden = false;
    caret.setAttribute("aria-expanded", "true");
    (menuEl.querySelector(".menuitem") as HTMLElement | null)?.focus();
  }
  function closeMenu(): void {
    if (!(menuEl && caret)) {
      return;
    }
    menuEl.hidden = true;
    caret.setAttribute("aria-expanded", "false");
  }
  function toggleMenu(): void {
    if (menuEl?.hidden) {
      openMenu();
    } else {
      closeMenu();
    }
  }
  function onMenuKeydown(e: KeyboardEvent): void {
    if (!menuEl) {
      return;
    }
    const itemEls = Array.from(
      menuEl.querySelectorAll(".menuitem")
    ) as HTMLElement[];
    const idx = itemEls.indexOf(shadow.activeElement as HTMLElement);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      itemEls[(idx + 1) % itemEls.length]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      itemEls[(idx - 1 + itemEls.length) % itemEls.length]?.focus();
    } else if (e.key === "Tab") {
      // Tab out closes the menu (WAI-ARIA menu-button pattern); let focus move.
      closeMenu();
    }
  }

  function safeExtract(): ExtractResult | null {
    try {
      return extract(win.document, {
        content: options.content,
        header: options.header,
      });
    } catch {
      return null;
    }
  }
  function isEmpty(s: string): boolean {
    return s.trim() === "";
  }

  async function runAction(action: Action): Promise<void> {
    const result = safeExtract();
    const markdown = result?.markdown ?? "";

    if (action === "view") {
      openOverlay(markdown);
      if (isEmpty(markdown)) {
        toast(MSG.failed);
      }
      return;
    }

    if (isEmpty(markdown)) {
      toast(MSG.failed);
      openOverlay(markdown);
      return;
    }

    if (action === "copy") {
      const ok = await copyText(markdown, win);
      if (ok) {
        flashCopied();
      } else {
        openOverlay(markdown);
      }
      return;
    }

    // chatgpt | claude: open the tab SYNCHRONOUSLY (within the click gesture) —
    // WebKit/Firefox block window.open after an await, since user activation is
    // lost. Everything the URL needs is already known, so open first, then copy
    // the markdown as a silent clipboard fallback.
    const isPublic = isPublicUrl(result?.url ?? "");
    win.open(
      llmUrl(action as LlmTarget, result?.url ?? "", isPublic),
      "_blank",
      "noopener,noreferrer"
    );
    if (!isPublic) {
      toast(MSG.paste);
    }
    await copyText(markdown, win);
  }

  // Swap the primary button's icon + label, restarting the swap-in keyframe so
  // each change animates (snappy settle in, see styles.ts `.primary.c2l-swap`).
  function setPrimary(text: string, iconMarkup: string): void {
    primaryLabel.textContent = text;
    primary.querySelector(".c2l-ic")?.remove();
    prependIcon(primary, doc, iconMarkup);
    primary.classList.remove("c2l-swap");
    // Read layout to force a reflow so re-adding the class re-triggers the keyframe.
    primary.getBoundingClientRect();
    primary.classList.add("c2l-swap");
  }

  // Copy confirmation on the button itself: morph to "Copied ✓", then revert.
  function flashCopied(): void {
    if (state.copiedTimer !== undefined) {
      win.clearTimeout(state.copiedTimer);
    }
    setPrimary(COPIED_LABEL, CHECK_ICON);
    state.copiedTimer = win.setTimeout(() => {
      setPrimary(labels[primaryAction], ICONS[primaryAction]);
      state.copiedTimer = undefined;
    }, COPIED_MS) as unknown as number;
  }

  function toast(message: string): void {
    toastEl.textContent = message;
    toastEl.hidden = false;
    if (state.toastTimer !== undefined) {
      win.clearTimeout(state.toastTimer);
    }
    state.toastTimer = win.setTimeout(() => {
      toastEl.hidden = true;
    }, TOAST_MS) as unknown as number;
  }

  function ensureOverlay(): HTMLElement {
    if (state.overlayEl) {
      return state.overlayEl;
    }
    const ov = doc.createElement("div");
    ov.className = "overlay";
    ov.hidden = true;
    ov.setAttribute("role", "dialog");
    ov.setAttribute("aria-modal", "true");
    ov.setAttribute("aria-label", "Page as Markdown");
    ov.innerHTML =
      '<div class="sheet"><header><h2>Page as Markdown</h2>' +
      '<div class="tools">' +
      '<button class="btn ov-copy" type="button">Copy</button>' +
      '<button class="btn ov-close" type="button" aria-label="Close">Close</button>' +
      "</div></header><pre></pre></div>";

    const copyBtn = ov.querySelector(".ov-copy") as HTMLButtonElement;
    const closeBtn = ov.querySelector(".ov-close") as HTMLButtonElement;
    const pre = ov.querySelector("pre") as HTMLElement;
    // Make the scrollable markdown body keyboard-focusable so long output is
    // reachable (otherwise keyboard users can't scroll past the first screen).
    pre.tabIndex = 0;
    pre.setAttribute("aria-label", "Markdown source");
    copyBtn.addEventListener("click", async () => {
      const ok = await copyText(state.currentMarkdown, win);
      toast(ok ? MSG.copied : MSG.failed);
    });
    closeBtn.addEventListener("click", closeOverlay);
    ov.addEventListener("click", (e) => {
      if (e.target === ov) {
        closeOverlay();
      }
    });
    const focusables = [copyBtn, closeBtn, pre];
    ov.addEventListener("keydown", (e) => {
      if (e.key !== "Tab") {
        return;
      }
      // Focus trap across Copy / Close / the scrollable body.
      e.preventDefault();
      const i = focusables.indexOf(shadow.activeElement as HTMLElement);
      const dir = e.shiftKey ? -1 : 1;
      const n = focusables.length;
      focusables[(i + dir + n) % n]?.focus();
    });
    rootEl.appendChild(ov);
    state.overlayEl = ov;
    return ov;
  }

  function openOverlay(markdown: string): void {
    state.currentMarkdown = markdown;
    const ov = ensureOverlay();
    (ov.querySelector("pre") as HTMLElement).textContent = markdown;
    state.prevFocus = shadow.activeElement;
    ov.hidden = false;
    (ov.querySelector(".ov-close") as HTMLButtonElement).focus();
  }
  function closeOverlay(): void {
    if (state.overlayEl) {
      state.overlayEl.hidden = true;
    }
    // Restore focus to the trigger; fall back to the widget if it's gone (e.g. a
    // menu item that was hidden when the overlay opened collapses focus to body).
    const restore = (state.prevFocus as HTMLElement | null) ?? caret ?? primary;
    restore?.focus?.();
  }

  function destroy(): void {
    stopWatch();
    doc.removeEventListener("click", onDocPointer, true);
    doc.removeEventListener("keydown", onDocKey);
    if (state.toastTimer !== undefined) {
      win.clearTimeout(state.toastTimer);
    }
    if (state.copiedTimer !== undefined) {
      win.clearTimeout(state.copiedTimer);
    }
    hostEl.remove();
  }
}
