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
import { type ResolvedTheme, resolveTheme, watchTheme } from "./theme";

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

// Stash the handle on the host element for idempotent re-mounts.
type WithHandle = HTMLElement & { [HANDLE_KEY]?: WidgetHandle };

interface State {
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
  primary.textContent = labels[primaryAction];
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
    caret.textContent = "▾";
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
      const item = doc.createElement("button");
      item.className = "menuitem";
      item.type = "button";
      item.setAttribute("role", "menuitem");
      item.dataset.action = action;
      item.textContent = labels[action];
      item.addEventListener("click", () => {
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
        toast(MSG.copied);
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
    hostEl.remove();
  }
}
