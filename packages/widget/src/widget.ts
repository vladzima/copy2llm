import { type ExtractResult, extract } from "copy2llm-core";
import { copyText, copyTextSync } from "./clipboard";
import {
  addContextItem,
  buildContextMarkdown,
  type ContextItem,
  contextCharacters,
  createContextItem,
  estimateTokens,
  loadContext,
  moveContextItem,
  saveContext,
} from "./context";
import { customLink, type LlmLink, type LlmTarget, llmUrl } from "./links";
import {
  type Action,
  ALL_ACTIONS,
  type ContextKind,
  type Copy2LLMEventDetail,
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
  handoffFailed: "Couldn’t open the chat — use the Markdown preview",
  pasteFailed: "Couldn’t copy automatically — copy from the preview",
  paste: "Copied — paste into the chat",
  pick: "Click a section to copy it — Esc cancels",
  pickContext: "Click a section to add it — Esc cancels",
};

const MENU_LABELS: Record<Action, string> = {
  copy: DEFAULTS.label,
  pick: "Copy a section",
  context: "Add to AI context",
  view: "View as Markdown",
  chatgpt: "Open in ChatGPT",
  claude: "Open in Claude",
  perplexity: "Open in Perplexity",
  grok: "Open in Grok",
};
const CONTEXT_TARGET_LABELS: Record<LlmTarget, string> = {
  chatgpt: "ChatGPT",
  claude: "Claude",
  perplexity: "Perplexity",
  grok: "Grok",
};

// Monoline action glyphs (Phosphor) + the ChatGPT/Claude brand marks, drawn in
// `currentColor` so they inherit the resolved theme. Kept inline to avoid a
// network request and to survive Shadow-DOM isolation.
const ICONS: Record<Action, string> = {
  copy: '<svg class="c2l-ic" viewBox="0 0 256 256" aria-hidden="true"><path d="M216,32H88a8,8,0,0,0-8,8V80H40a8,8,0,0,0-8,8V216a8,8,0,0,0,8,8H168a8,8,0,0,0,8-8V176h40a8,8,0,0,0,8-8V40A8,8,0,0,0,216,32ZM160,208H48V96H160Zm48-48H176V88a8,8,0,0,0-8-8H96V48H208Z"/></svg>',
  pick: '<svg class="c2l-ic" viewBox="0 0 256 256" aria-hidden="true"><path d="M216,40H176a8,8,0,0,0,0,16h32V88a8,8,0,0,0,16,0V48A8,8,0,0,0,216,40ZM80,200H48V168a8,8,0,0,0-16,0v40a8,8,0,0,0,8,8H80a8,8,0,0,0,0-16Zm136-40a8,8,0,0,0-8,8v32H176a8,8,0,0,0,0,16h40a8,8,0,0,0,8-8V168A8,8,0,0,0,216,160ZM80,40H40a8,8,0,0,0-8,8V88a8,8,0,0,0,16,0V56H80a8,8,0,0,0,0-16Z"/></svg>',
  context:
    '<svg class="c2l-ic" viewBox="0 0 256 256" aria-hidden="true"><path d="M197.58,129.06l-51.61-19-19-51.65a15.92,15.92,0,0,0-29.88,0l-19,51.61-51.65,19a15.92,15.92,0,0,0,0,29.88l51.61,19,19,51.65a15.92,15.92,0,0,0,29.88,0l19-51.61,51.65-19a15.92,15.92,0,0,0,0-29.88Z"/></svg>',
  view: '<svg class="c2l-ic" viewBox="0 0 256 256" aria-hidden="true"><path d="M86.75,44.3,33.48,128l53.27,83.7a8,8,0,0,1-2.46,11.05A7.91,7.91,0,0,1,80,224a8,8,0,0,1-6.76-3.71l-56-88a8,8,0,0,1,0-8.59l56-88a8,8,0,1,1,13.5,8.59Zm152,79.41-56-88a8,8,0,1,0-13.5,8.59L222.52,128l-53.27,83.7a8,8,0,0,0,2.46,11.05A7.91,7.91,0,0,0,176,224a8,8,0,0,0,6.76-3.71l56-88A8,8,0,0,0,238.75,123.71Z"/></svg>',
  chatgpt:
    '<svg class="c2l-ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z"/></svg>',
  claude:
    '<svg class="c2l-ic" viewBox="0 0 24 24" aria-hidden="true"><path d="m4.7144 15.9555 4.7174-2.6471.079-.2307-.079-.1275h-.2307l-.7893-.0486-2.6956-.0729-2.3375-.0971-2.2646-.1214-.5707-.1215-.5343-.7042.0546-.3522.4797-.3218.686.0608 1.5179.1032 2.2767.1578 1.6514.0972 2.4468.255h.3886l.0546-.1579-.1336-.0971-.1032-.0972L6.973 9.8356l-2.55-1.6879-1.3356-.9714-.7225-.4918-.3643-.4614-.1578-1.0078.6557-.7225.8803.0607.2246.0607.8925.686 1.9064 1.4754 2.4893 1.8336.3643.3035.1457-.1032.0182-.0728-.164-.2733-1.3539-2.4467-1.445-2.4893-.6435-1.032-.17-.6194c-.0607-.255-.1032-.4674-.1032-.7285L6.287.1335 6.6997 0l.9957.1336.419.3642.6192 1.4147 1.0018 2.2282 1.5543 3.0296.4553.8985.2429.8318.091.255h.1579v-.1457l.1275-1.706.2368-2.0947.2307-2.6957.0789-.7589.3764-.9107.7468-.4918.5828.2793.4797.686-.0668.4433-.2853 1.8517-.5586 2.9021-.3643 1.9429h.2125l.2429-.2429.9835-1.3053 1.6514-2.0643.7286-.8196.85-.9046.5464-.4311h1.0321l.759 1.1293-.34 1.1657-1.0625 1.3478-.8804 1.1414-1.2628 1.7-.7893 1.36.0729.1093.1882-.0183 2.8535-.607 1.5421-.2794 1.8396-.3157.8318.3886.091.3946-.3278.8075-1.967.4857-2.3072.4614-3.4364.8136-.0425.0304.0486.0607 1.5482.1457.6618.0364h1.621l3.0175.2247.7892.522.4736.6376-.079.4857-1.2142.6193-1.6393-.3886-3.825-.9107-1.3113-.3279h-.1822v.1093l1.0929 1.0686 2.0035 1.8092 2.5075 2.3314.1275.5768-.3218.4554-.34-.0486-2.2039-1.6575-.85-.7468-1.9246-1.621h-.1275v.17l.4432.6496 2.3436 3.5214.1214 1.0807-.17.3521-.6071.2125-.6679-.1214-1.3721-1.9246L14.38 17.959l-1.1414-1.9428-.1397.079-.674 7.2552-.3156.3703-.7286.2793-.6071-.4614-.3218-.7468.3218-1.4753.3886-1.9246.3157-1.53.2853-1.9004.17-.6314-.0121-.0425-.1397.0182-1.4328 1.9672-2.1796 2.9446-1.7243 1.8456-.4128.164-.7164-.3704.0667-.6618.4008-.5889 2.386-3.0357 1.4389-1.882.929-1.0868-.0062-.1579h-.0546l-6.3385 4.1164-1.1293.1457-.4857-.4554.0608-.7467.2307-.2429 1.9064-1.3114Z"/></svg>',
  perplexity:
    '<svg class="c2l-ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M22.3977 7.0896h-2.3106V.0676l-7.5094 6.3542V.1577h-1.1554v6.1966L4.4904 0v7.0896H1.6023v10.3976h2.8882V24l6.932-6.3591v6.2005h1.1554v-6.0469l6.9318 6.1807v-6.4879h2.8882V7.0896zm-3.4657-4.531v4.531h-5.355l5.355-4.531zm-13.2862.0676 4.8691 4.4634H5.6458V2.6262zM2.7576 16.332V8.245h7.8476l-6.1149 6.1147v1.9723H2.7576zm2.8882 5.0404v-3.8852h.0001v-2.6488l5.7763-5.7764v7.0111l-5.7764 5.2993zm12.7086.0248-5.7766-5.1509V9.0618l5.7766 5.7766v6.5588zm2.8882-5.0652h-1.733v-1.9723L13.3948 8.245h7.8478v8.087z"/></svg>',
  grok: '<svg class="c2l-ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M9.27 15.29l7.978-5.897c.391-.29.95-.177 1.137.272.98 2.369.542 5.215-1.41 7.169-1.951 1.954-4.667 2.382-7.149 1.406l-2.711 1.257c3.889 2.661 8.611 2.003 11.562-.953 2.341-2.344 3.066-5.539 2.388-8.42l.006.007c-.983-4.232.242-5.924 2.75-9.383.06-.082.12-.164.179-.248l-3.301 3.305v-.01L9.267 15.292M7.623 16.723c-2.792-2.67-2.31-6.801.071-9.184 1.761-1.763 4.647-2.483 7.166-1.425l2.705-1.25a7.808 7.808 0 00-1.829-1A8.975 8.975 0 005.984 5.83c-2.533 2.536-3.33 6.436-1.962 9.764 1.022 2.487-.653 4.246-2.34 6.022-.599.63-1.199 1.259-1.682 1.925l7.62-6.815"/></svg>',
};
// Generic mark for a site-owner custom endpoint (no brand glyph available).
const CUSTOM_ICON =
  '<svg class="c2l-ic" viewBox="0 0 256 256" aria-hidden="true"><path d="M197.58,129.06,146,110l-19-51.62a15.92,15.92,0,0,0-29.88,0L78,110l-51.62,19a15.92,15.92,0,0,0,0,29.88L78,178l19,51.62a15.92,15.92,0,0,0,29.88,0L146,178l51.62-19a15.92,15.92,0,0,0,0-29.88ZM137,164.22a8,8,0,0,0-4.74,4.74L112,223.85,91.78,169A8,8,0,0,0,87,164.22L32.15,144,87,123.78A8,8,0,0,0,91.78,119L112,64.15,132.22,119a8,8,0,0,0,4.74,4.74L191.85,144Z"/></svg>';
const CARET_ICON =
  '<svg class="c2l-ic" viewBox="0 0 256 256" aria-hidden="true"><path d="M213.66,101.66l-80,80a8,8,0,0,1-11.32,0l-80-80A8,8,0,0,1,53.66,90.34L128,164.69l74.34-74.35a8,8,0,0,1,11.32,11.32Z"/></svg>';
const EXT_ICON =
  '<svg class="c2l-ext" viewBox="0 0 256 256" aria-hidden="true"><path d="M200,64V168a8,8,0,0,1-16,0V83.31L69.66,197.66a8,8,0,0,1-11.32-11.32L172.69,72H88a8,8,0,0,1,0-16H192A8,8,0,0,1,200,64Z"/></svg>';
const ADD_ICON =
  '<svg class="c2l-ic" viewBox="0 0 256 256" aria-hidden="true"><path d="M216,128a8,8,0,0,1-8,8H136v72a8,8,0,0,1-16,0V136H48a8,8,0,0,1,0-16h72V48a8,8,0,0,1,16,0v72h72A8,8,0,0,1,216,128Z"/></svg>';
const DOWNLOAD_ICON =
  '<svg class="c2l-ic" viewBox="0 0 256 256" aria-hidden="true"><path d="M224,144v64a8,8,0,0,1-8,8H40a8,8,0,0,1-8-8V144a8,8,0,0,1,16,0v56H208V144a8,8,0,0,1,16,0ZM122.34,157.66a8,8,0,0,0,11.32,0l48-48a8,8,0,0,0-11.32-11.32L136,132.69V32a8,8,0,0,0-16,0V132.69L85.66,98.34a8,8,0,0,0-11.32,11.32Z"/></svg>';
// Shown in the primary button after a successful copy (replaces the side toast).
const CHECK_ICON =
  '<svg class="c2l-ic" viewBox="0 0 256 256" aria-hidden="true"><path d="M229.66,77.66l-128,128a8,8,0,0,1-11.32,0l-56-56a8,8,0,0,1,11.32-11.32L96,188.69,218.34,66.34a8,8,0,0,1,11.32,11.32Z"/></svg>';
const COPIED_LABEL = "Copied";
// Primary Copy label while the page has an active text selection (every action
// then uses the selection instead of the whole page).
const SELECTED_LABEL = "Copy selected";
const SELECTED_CONTEXT_LABEL = "Add selection to context";
const COPIED_MS = 1400;
// `auto` reveal: poll for a confident theme signal for up to this many frames
// (~0.5s) before falling back to prefers-color-scheme, so a late-painting host
// background can't flash a wrong-theme button.
const REVEAL_MAX_FRAMES = 30;
const EXTERNAL = new Set<Action>(["chatgpt", "claude", "perplexity", "grok"]);
// Blocks a region-pick click can select — the meaningful content units the
// spec calls out (paragraphs, sections, tables, code), nearest match first.
const PICK_SELECTOR =
  "p, pre, table, ul, ol, dl, blockquote, figure, h1, h2, h3, h4, h5, h6, section, article";

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

interface MenuItemSpec {
  /** `data-action` value (a built-in Action, or `endpoint` for custom targets). */
  action: string;
  /** Deep link → render the trailing arrow and open in a new tab. */
  external: boolean;
  icon: string;
  label: string;
}

/** Build one menu row: leading glyph, label, and a trailing arrow for deep links. */
function buildMenuItem(
  doc: Document,
  spec: MenuItemSpec,
  onClick: () => void
): HTMLButtonElement {
  const item = doc.createElement("button");
  item.className = "menuitem";
  item.type = "button";
  item.setAttribute("role", "menuitem");
  item.dataset.action = spec.action;
  appendIcon(item, doc, spec.icon);
  const itemLabel = doc.createElement("span");
  itemLabel.className = "c2l-label";
  itemLabel.textContent = spec.label;
  item.appendChild(itemLabel);
  if (spec.external) {
    appendIcon(item, doc, EXT_ICON);
  }
  item.addEventListener("click", onClick);
  return item;
}

// Stash the handle on the host element for idempotent re-mounts.
type WithHandle = HTMLElement & { [HANDLE_KEY]?: WidgetHandle };

interface State {
  contextItems: ContextItem[];
  contextOverlayEl: HTMLElement | null;
  copiedTimer?: number;
  currentMarkdown: string;
  overlayEl: HTMLElement | null;
  /** Tears down region-pick mode; null when pick mode is off. */
  pickCleanup: (() => void) | null;
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
  const win = (doc.defaultView ?? globalThis) as Window & typeof globalThis;
  let storage: Storage | null = null;
  try {
    storage = win.sessionStorage;
  } catch {
    // Storage can be unavailable in privacy modes; the cart still works in memory.
  }

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
    contextItems: loadContext(storage),
    contextOverlayEl: null,
    overlayEl: null,
    pickCleanup: null,
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
    '<button class="btn context-status" type="button" hidden></button>' +
    '<div class="toast" role="status" aria-live="polite" hidden></div>' +
    "</div>";
  shadow.append(styleEl, rootEl);

  const box = rootEl.querySelector(".box") as HTMLElement;
  const split = rootEl.querySelector(".split") as HTMLElement;
  const contextStatus = rootEl.querySelector(
    ".context-status"
  ) as HTMLButtonElement;
  const toastEl = rootEl.querySelector(".toast") as HTMLElement;
  const primary = rootEl.querySelector(".primary") as HTMLButtonElement;
  contextStatus.addEventListener("click", openContextOverlay);
  renderContextStatus();

  // Preserve the page's text selection: a mousedown on any widget button would
  // collapse it before the click handler could read it (see pageSelection).
  rootEl.addEventListener("mousedown", (e) => {
    if ((e.target as Element | null)?.closest?.(".btn, .menuitem")) {
      e.preventDefault();
    }
  });

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
  // Site-owner custom targets, appended after the built-ins; guard against junk
  // (the React/Framer prop path isn't validated like `data-endpoints` is).
  const endpoints = (options.endpoints ?? []).filter(
    (e) => e && typeof e.label === "string" && typeof e.href === "string"
  );
  let menuEl: HTMLElement | null = null;
  let caret: HTMLButtonElement | null = null;

  if (menuActions.length === 0 && endpoints.length === 0) {
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
      const item = buildMenuItem(
        doc,
        {
          action,
          icon: ICONS[action],
          label: labels[action],
          external: EXTERNAL.has(action),
        },
        () => {
          closeMenu();
          runAction(action).catch(() => undefined);
        }
      );
      menuEl.appendChild(item);
    }
    for (const ep of endpoints) {
      const item = buildMenuItem(
        doc,
        {
          action: "endpoint",
          icon: CUSTOM_ICON,
          label: ep.label,
          external: true,
        },
        () => {
          closeMenu();
          runEndpoint(ep.href, ep.label);
        }
      );
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
    } else if (state.contextOverlayEl && !state.contextOverlayEl.hidden) {
      closeContextOverlay();
    } else if (state.overlayEl && !state.overlayEl.hidden) {
      closeOverlay();
    }
  };
  // Flip the primary Copy label to "Copy selected" while a page selection is
  // active, so the button says what a click will actually copy. Plain text
  // assignment (no swap keyframe): selectionchange fires on every drag tick.
  const onSelectionChange = () => {
    if (
      (primaryAction !== "copy" && primaryAction !== "context") ||
      state.copiedTimer !== undefined
    ) {
      return;
    }
    primaryLabel.textContent = idlePrimaryLabel();
  };
  doc.addEventListener("click", onDocPointer, true);
  doc.addEventListener("keydown", onDocKey);
  doc.addEventListener("selectionchange", onSelectionChange);

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

  /** The user's active selection, if it lives in the page (not our shadow UI). */
  function pageSelection(): Range | undefined {
    const sel = win.getSelection?.();
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
      return;
    }
    const range = sel.getRangeAt(0);
    return range.commonAncestorContainer.getRootNode?.() === doc
      ? range
      : undefined;
  }

  /** Extract the page — or just `region` / the live text selection when present. */
  function safeExtract(
    region?: Range | Element,
    header = options.header
  ): ExtractResult | null {
    try {
      return extract(win.document, {
        content: options.content,
        exclude: options.exclude,
        header,
        region: region ?? pageSelection(),
      });
    } catch {
      return null;
    }
  }
  function isEmpty(s: string): boolean {
    return s.trim() === "";
  }

  async function runAction(action: Action): Promise<void> {
    if (action === "pick") {
      startPick("copy");
      return;
    }

    if (action === "context") {
      addCurrentContext();
      return;
    }

    const result = safeExtract();
    const markdown = result?.markdown ?? "";

    if (action === "view") {
      openOverlay(markdown);
      emit({ action, success: !isEmpty(markdown) }, markdown);
      if (isEmpty(markdown)) {
        toast(MSG.failed);
      }
      return;
    }

    if (isEmpty(markdown)) {
      emit({ action, success: false }, markdown);
      toast(MSG.failed);
      openOverlay(markdown);
      return;
    }

    if (action === "copy") {
      await copyMarkdown(markdown);
      return;
    }

    // chatgpt | claude | perplexity | grok: hand the LLM the page's Markdown
    // itself via the chat's ?q= prefill — that IS the product.
    openLlm(
      llmUrl(action as LlmTarget, markdown, options.prompt),
      markdown,
      action,
      action
    );
  }

  async function copyMarkdown(markdown: string): Promise<void> {
    const ok = await copyText(markdown, win);
    emit(
      {
        action: "copy",
        fallback: ok ? undefined : "markdown-preview",
        success: ok,
      },
      markdown
    );
    if (ok) {
      flashCopied();
    } else {
      openOverlay(markdown);
    }
  }

  // --- region-pick mode ("copy just this") ------------------------------------
  // Hover highlights the content block under the pointer; click copies it; Esc
  // (or a click that hits no block) exits. The highlight box and crosshair
  // cursor live in the page, not our shadow root, so position:fixed can't be
  // broken by a transformed ancestor.
  function pickTarget(target: EventTarget | null): Element | null {
    const el = target as Element | null;
    if (!el || hostEl.contains(el) || typeof el.closest !== "function") {
      return null;
    }
    return el.closest(PICK_SELECTOR);
  }

  function startPick(mode: "context" | "copy"): void {
    if (state.pickCleanup) {
      return;
    }
    const boxEl = doc.createElement("div");
    boxEl.style.cssText =
      "position:fixed;display:none;pointer-events:none;z-index:2147482999;" +
      "background:rgba(82,139,255,0.13);outline:2px solid rgba(82,139,255,0.85);" +
      "outline-offset:-1px;border-radius:3px;";
    const cursorEl = doc.createElement("style");
    cursorEl.textContent = "* { cursor: crosshair !important; }";
    doc.body.appendChild(boxEl);
    (doc.head ?? doc.body).appendChild(cursorEl);

    let hovered: Element | null = null;
    const place = () => {
      if (!hovered) {
        boxEl.style.display = "none";
        return;
      }
      const r = hovered.getBoundingClientRect();
      boxEl.style.display = "block";
      boxEl.style.top = `${r.top}px`;
      boxEl.style.left = `${r.left}px`;
      boxEl.style.width = `${r.width}px`;
      boxEl.style.height = `${r.height}px`;
    };
    const onMove = (e: Event) => {
      hovered = pickTarget(e.target);
      place();
    };
    const onPickClick = (e: Event) => {
      if (hostEl.contains(e.target as Node)) {
        exitPick(); // clicking the widget cancels; its own handlers still run
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      const el = pickTarget(e.target);
      exitPick();
      if (el) {
        if (mode === "context") {
          addRegionContext(el);
        } else {
          copyRegion(el).catch(() => undefined);
        }
      }
    };
    const onPickKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        exitPick();
      }
    };
    doc.addEventListener("mousemove", onMove, true);
    doc.addEventListener("click", onPickClick, true);
    doc.addEventListener("keydown", onPickKey, true);
    win.addEventListener("scroll", place, true);
    state.pickCleanup = () => {
      doc.removeEventListener("mousemove", onMove, true);
      doc.removeEventListener("click", onPickClick, true);
      doc.removeEventListener("keydown", onPickKey, true);
      win.removeEventListener("scroll", place, true);
      boxEl.remove();
      cursorEl.remove();
      state.pickCleanup = null;
    };
    toast(mode === "context" ? MSG.pickContext : MSG.pick);
  }

  function exitPick(): void {
    state.pickCleanup?.();
  }

  // Copy just the picked block; its Source header deep-links to the section.
  async function copyRegion(el: Element): Promise<void> {
    const markdown = safeExtract(el)?.markdown ?? "";
    if (isEmpty(markdown)) {
      emit({ action: "pick", context: "section", success: false }, markdown);
      toast(MSG.failed);
      return;
    }
    const ok = await copyText(markdown, win);
    emit(
      {
        action: "pick",
        context: "section",
        fallback: ok ? undefined : "markdown-preview",
        success: ok,
      },
      markdown
    );
    if (ok) {
      flashCopied();
    } else {
      openOverlay(markdown);
    }
  }

  // A site-owner custom endpoint: same flow as a built-in target, but the deep
  // link comes from their `hrefTemplate` rather than a built-in base.
  function runEndpoint(href: string, label: string): void {
    const markdown = safeExtract()?.markdown ?? "";
    if (isEmpty(markdown)) {
      emit({ action: "endpoint", success: false, target: label }, markdown);
      toast(MSG.failed);
      openOverlay(markdown);
      return;
    }
    openLlm(
      customLink(href, markdown, options.prompt),
      markdown,
      "endpoint",
      label
    );
  }

  // Open a target's deep link. Fire SYNCHRONOUSLY within the click gesture
  // (WebKit/Firefox block window.open after an await, since user activation is
  // lost). When the page is too long to inline, copy BEFORE the tab opens — a
  // synchronous copy keeps the page focused (no permission prompt) and preserves
  // the popup gesture; the Markdown is then on the clipboard, ready to paste.
  function openLlm(
    link: LlmLink,
    markdown: string,
    action: Action | "endpoint" | "context-copy" | "context-send",
    target: string,
    context?: ContextKind
  ): void {
    const eventItems = action.startsWith("context-")
      ? state.contextItems.length
      : undefined;
    if (link.needsPaste) {
      const copied = copyTextSync(markdown, win);
      if (!copied) {
        openOverlay(markdown);
        toast(MSG.pasteFailed);
        emit(
          {
            action,
            context,
            fallback: "markdown-preview",
            items: eventItems,
            success: false,
            target,
          },
          markdown
        );
        return;
      }
    }
    try {
      win.open(link.href, "_blank", "noopener,noreferrer");
    } catch {
      openOverlay(markdown);
      toast(MSG.handoffFailed);
      emit(
        {
          action,
          context,
          fallback: "markdown-preview",
          items: eventItems,
          success: false,
          target,
        },
        markdown
      );
      return;
    }
    if (link.needsPaste) {
      toast(MSG.paste);
    }
    emit(
      {
        action,
        context,
        fallback: link.needsPaste ? "clipboard-paste" : undefined,
        items: eventItems,
        success: true,
        target,
      },
      markdown
    );
  }

  function emit(
    detail: Omit<Copy2LLMEventDetail, "approximateTokens" | "characters">,
    markdown: string
  ): void {
    const payload: Copy2LLMEventDetail = {
      approximateTokens: estimateTokens(markdown.length),
      characters: markdown.length,
      ...detail,
    };
    try {
      options.onEvent?.(payload);
    } catch {
      // A site-owner callback must never break the user action.
    }
    hostEl.dispatchEvent(
      new win.CustomEvent<Copy2LLMEventDetail>("copy2llm:action", {
        bubbles: true,
        composed: true,
        detail: payload,
      })
    );
  }

  function commitContext(items: ContextItem[]): void {
    state.contextItems = items;
    saveContext(storage, items);
    renderContextStatus();
    if (state.contextOverlayEl && !state.contextOverlayEl.hidden) {
      renderContextOverlay();
    }
  }

  function renderContextStatus(): void {
    const count = state.contextItems.length;
    contextStatus.hidden = count === 0;
    contextStatus.textContent = `Context ${count}`;
    contextStatus.title = `${count} source${count === 1 ? "" : "s"}, approximately ${estimateTokens(contextCharacters(state.contextItems)).toLocaleString()} tokens`;
  }

  function addExtractedContext(
    result: ExtractResult | null,
    kind: ContextKind
  ): boolean {
    const markdown = result?.markdown ?? "";
    if (isEmpty(markdown)) {
      toast(MSG.failed);
      emit({ action: "context", context: kind, success: false }, markdown);
      return false;
    }
    const mutation = addContextItem(
      state.contextItems,
      createContextItem({
        kind,
        markdown,
        title: result?.title ?? doc.title,
        url: result?.url ?? doc.URL,
      })
    );
    if (mutation.status === "full") {
      toast("Context is full — remove a source first");
      emit(
        {
          action: "context",
          context: kind,
          items: state.contextItems.length,
          success: false,
        },
        markdown
      );
      return false;
    }
    if (mutation.status === "duplicate") {
      toast("Already in context");
    } else {
      commitContext(mutation.items);
      toast(
        mutation.status === "updated" ? "Context updated" : "Added to context"
      );
    }
    emit(
      {
        action: "context",
        context: kind,
        items: mutation.items.length,
        success: true,
      },
      markdown
    );
    return true;
  }

  function addCurrentContext(): void {
    const selection = pageSelection();
    const result = safeExtract(selection, false);
    if (addExtractedContext(result, selection ? "selection" : "page")) {
      openContextOverlay();
    }
  }

  function addRegionContext(el: Element): void {
    const result = safeExtract(el, false);
    if (addExtractedContext(result, "section")) {
      openContextOverlay();
    }
  }

  function sourceLabel(url: string): string {
    try {
      const parsed = new URL(url);
      return `${parsed.hostname}${parsed.pathname === "/" ? "" : parsed.pathname}`;
    } catch {
      return url || "Source unavailable";
    }
  }

  function contextMarkdown(): string {
    return buildContextMarkdown(state.contextItems);
  }

  function ensureContextOverlay(): HTMLElement {
    if (state.contextOverlayEl) {
      return state.contextOverlayEl;
    }
    const ov = doc.createElement("div");
    ov.className = "overlay context-overlay";
    ov.hidden = true;
    ov.setAttribute("role", "dialog");
    ov.setAttribute("aria-modal", "true");
    ov.setAttribute("aria-label", "Review AI context");
    ov.innerHTML =
      '<div class="sheet context-sheet"><header>' +
      '<div class="context-heading"><h2>AI context</h2><p class="context-summary"></p></div>' +
      '<button class="btn context-close" type="button" aria-label="Close">Close</button>' +
      '</header><div class="context-body">' +
      '<div class="context-empty"><strong>No sources yet</strong><span>Add this page, a selection, or a specific section.</span></div>' +
      '<ol class="context-list"></ol></div><footer>' +
      '<div class="context-footer-row"><span class="context-footer-label">Add sources</span>' +
      '<div class="context-add"><button class="btn context-add-current" type="button"><span class="c2l-label">Add current page</span></button>' +
      '<button class="btn context-add-section" type="button"><span class="c2l-label">Add a section</span></button></div></div>' +
      '<div class="context-footer-row"><span class="context-footer-label">Export</span>' +
      '<div class="context-export"><button class="btn context-copy" type="button"><span class="c2l-label">Copy context</span></button>' +
      '<button class="btn context-download" type="button"><span class="c2l-label">Download .md</span></button></div></div>' +
      '<div class="context-footer-row"><span class="context-footer-label">Send to AI</span>' +
      '<div class="context-targets"></div></div></footer></div>';

    const closeBtn = ov.querySelector(".context-close") as HTMLButtonElement;
    const addCurrentBtn = ov.querySelector(
      ".context-add-current"
    ) as HTMLButtonElement;
    const addSectionBtn = ov.querySelector(
      ".context-add-section"
    ) as HTMLButtonElement;
    const copyBtn = ov.querySelector(".context-copy") as HTMLButtonElement;
    const downloadBtn = ov.querySelector(
      ".context-download"
    ) as HTMLButtonElement;
    const targetsEl = ov.querySelector(".context-targets") as HTMLElement;

    prependIcon(addCurrentBtn, doc, ADD_ICON);
    prependIcon(addSectionBtn, doc, ICONS.pick);
    prependIcon(copyBtn, doc, ICONS.copy);
    prependIcon(downloadBtn, doc, DOWNLOAD_ICON);

    closeBtn.addEventListener("click", closeContextOverlay);
    addCurrentBtn.addEventListener("click", addCurrentContext);
    addSectionBtn.addEventListener("click", () => {
      closeContextOverlay();
      startPick("context");
    });
    copyBtn.addEventListener("click", async () => {
      const markdown = contextMarkdown();
      const ok =
        state.contextItems.length > 0 && (await copyText(markdown, win));
      emit(
        {
          action: "context-copy",
          fallback: ok ? undefined : "markdown-preview",
          items: state.contextItems.length,
          success: ok,
        },
        markdown
      );
      if (ok) {
        toast(MSG.copied);
      } else if (state.contextItems.length > 0) {
        closeContextOverlay();
        openOverlay(markdown);
      }
    });
    downloadBtn.addEventListener("click", () => {
      const markdown = contextMarkdown();
      const ok = state.contextItems.length > 0 && downloadMarkdown(markdown);
      emit(
        {
          action: "context-download",
          items: state.contextItems.length,
          success: ok,
        },
        markdown
      );
      if (!ok && state.contextItems.length > 0) {
        closeContextOverlay();
        openOverlay(markdown);
      }
    });
    ov.addEventListener("click", (event) => {
      if (event.target === ov) {
        closeContextOverlay();
      }
    });
    ov.addEventListener("keydown", (event) => trapFocus(ov, event));

    for (const action of items.filter((item) => EXTERNAL.has(item))) {
      const button = doc.createElement("button");
      button.className = "btn context-target";
      button.type = "button";
      button.setAttribute("aria-label", labels[action]);
      appendIcon(button, doc, ICONS[action]);
      const label = doc.createElement("span");
      label.className = "c2l-label";
      label.textContent = CONTEXT_TARGET_LABELS[action as LlmTarget];
      button.appendChild(label);
      button.addEventListener("click", () => {
        const markdown = contextMarkdown();
        if (state.contextItems.length > 0) {
          openLlm(
            llmUrl(action as LlmTarget, markdown, options.prompt),
            markdown,
            "context-send",
            action
          );
        }
      });
      targetsEl.appendChild(button);
    }
    for (const endpoint of endpoints) {
      const button = doc.createElement("button");
      button.className = "btn context-target";
      button.type = "button";
      appendIcon(button, doc, CUSTOM_ICON);
      const label = doc.createElement("span");
      label.className = "c2l-label";
      label.textContent = endpoint.label;
      button.appendChild(label);
      button.addEventListener("click", () => {
        const markdown = contextMarkdown();
        if (state.contextItems.length > 0) {
          openLlm(
            customLink(endpoint.href, markdown, options.prompt),
            markdown,
            "context-send",
            endpoint.label
          );
        }
      });
      targetsEl.appendChild(button);
    }

    rootEl.appendChild(ov);
    state.contextOverlayEl = ov;
    return ov;
  }

  function renderContextOverlay(): void {
    const ov = ensureContextOverlay();
    const list = ov.querySelector(".context-list") as HTMLOListElement;
    const empty = ov.querySelector(".context-empty") as HTMLElement;
    const summary = ov.querySelector(".context-summary") as HTMLElement;
    const addCurrent = ov.querySelector(
      ".context-add-current"
    ) as HTMLButtonElement;
    const actionButtons = ov.querySelectorAll(
      ".context-copy, .context-download, .context-target"
    ) as NodeListOf<HTMLButtonElement>;
    const count = state.contextItems.length;
    const tokens = estimateTokens(contextCharacters(state.contextItems));

    summary.textContent = `${count} source${count === 1 ? "" : "s"} · ~${tokens.toLocaleString()} tokens · local to this tab`;
    const addCurrentLabel = addCurrent.querySelector(
      ".c2l-label"
    ) as HTMLElement;
    addCurrentLabel.textContent = pageSelection()
      ? "Add current selection"
      : "Add current page";
    empty.hidden = count > 0;
    list.hidden = count === 0;
    for (const button of actionButtons) {
      button.disabled = count === 0;
    }
    list.replaceChildren();

    state.contextItems.forEach((item, index) => {
      const row = doc.createElement("li");
      row.className = "context-source";

      const info = doc.createElement("div");
      info.className = "context-source-info";
      const title = doc.createElement("strong");
      title.textContent = item.title || "Untitled source";
      const meta = doc.createElement("span");
      meta.textContent = `${sourceLabel(item.url)} · ${item.kind} · ~${estimateTokens(item.markdown.length).toLocaleString()} tokens`;
      info.append(title, meta);

      const controls = doc.createElement("div");
      controls.className = "context-source-controls";
      const up = contextControl(
        "↑",
        `Move ${item.title} up`,
        index === 0,
        () => {
          commitContext(moveContextItem(state.contextItems, item.id, -1));
          emit(
            {
              action: "context-reorder",
              context: item.kind,
              items: state.contextItems.length,
              success: true,
            },
            item.markdown
          );
        }
      );
      const down = contextControl(
        "↓",
        `Move ${item.title} down`,
        index === state.contextItems.length - 1,
        () => {
          commitContext(moveContextItem(state.contextItems, item.id, 1));
          emit(
            {
              action: "context-reorder",
              context: item.kind,
              items: state.contextItems.length,
              success: true,
            },
            item.markdown
          );
        }
      );
      const remove = contextControl(
        "Remove",
        `Remove ${item.title}`,
        false,
        () => {
          commitContext(
            state.contextItems.filter((existing) => existing.id !== item.id)
          );
          emit(
            {
              action: "context-remove",
              context: item.kind,
              items: state.contextItems.length,
              success: true,
            },
            item.markdown
          );
        }
      );
      remove.classList.add("context-remove");
      controls.append(up, down, remove);
      row.append(info, controls);
      list.appendChild(row);
    });
  }

  function contextControl(
    text: string,
    label: string,
    disabled: boolean,
    onClick: () => void
  ): HTMLButtonElement {
    const button = doc.createElement("button");
    button.className = "context-source-action";
    button.type = "button";
    button.textContent = text;
    button.disabled = disabled;
    button.setAttribute("aria-label", label);
    button.addEventListener("click", onClick);
    return button;
  }

  function openContextOverlay(): void {
    const ov = ensureContextOverlay();
    renderContextOverlay();
    if (state.overlayEl) {
      state.overlayEl.hidden = true;
    }
    state.prevFocus = shadow.activeElement;
    ov.hidden = false;
    (ov.querySelector(".context-close") as HTMLButtonElement).focus();
  }

  function closeContextOverlay(): void {
    if (state.contextOverlayEl) {
      state.contextOverlayEl.hidden = true;
    }
    const restore = contextStatus.hidden ? (caret ?? primary) : contextStatus;
    restore.focus();
  }

  function downloadMarkdown(markdown: string): boolean {
    try {
      if (typeof win.URL.createObjectURL !== "function") {
        return false;
      }
      const href = win.URL.createObjectURL(
        new win.Blob([markdown], { type: "text/markdown;charset=utf-8" })
      );
      const link = doc.createElement("a");
      link.href = href;
      link.download = "ai-context.md";
      doc.body.appendChild(link);
      link.click();
      link.remove();
      win.URL.revokeObjectURL(href);
      return true;
    } catch {
      return false;
    }
  }

  function trapFocus(overlay: HTMLElement, event: KeyboardEvent): void {
    if (event.key !== "Tab") {
      return;
    }
    const focusables = Array.from(
      overlay.querySelectorAll(
        'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
      )
    ) as HTMLElement[];
    if (focusables.length === 0) {
      return;
    }
    event.preventDefault();
    const index = focusables.indexOf(shadow.activeElement as HTMLElement);
    const direction = event.shiftKey ? -1 : 1;
    focusables[
      (index + direction + focusables.length) % focusables.length
    ]?.focus();
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

  function idlePrimaryLabel(): string {
    if (!pageSelection()) {
      return labels[primaryAction];
    }
    if (primaryAction === "context") {
      return SELECTED_CONTEXT_LABEL;
    }
    if (primaryAction === "copy") {
      return SELECTED_LABEL;
    }
    return labels[primaryAction];
  }

  // Copy confirmation on the button itself: morph to "Copied ✓", then revert.
  function flashCopied(): void {
    if (state.copiedTimer !== undefined) {
      win.clearTimeout(state.copiedTimer);
    }
    setPrimary(COPIED_LABEL, CHECK_ICON);
    state.copiedTimer = win.setTimeout(() => {
      // Revert selection-aware: the selection usually survives the copy.
      setPrimary(idlePrimaryLabel(), ICONS[primaryAction]);
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
    if (state.contextOverlayEl) {
      state.contextOverlayEl.hidden = true;
    }
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
    exitPick();
    doc.removeEventListener("click", onDocPointer, true);
    doc.removeEventListener("keydown", onDocKey);
    doc.removeEventListener("selectionchange", onSelectionChange);
    if (state.toastTimer !== undefined) {
      win.clearTimeout(state.toastTimer);
    }
    if (state.copiedTimer !== undefined) {
      win.clearTimeout(state.copiedTimer);
    }
    hostEl.remove();
  }
}
