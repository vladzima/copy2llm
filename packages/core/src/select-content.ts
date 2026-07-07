import { Readability } from "@mozilla/readability";

export interface SelectedContent {
  root: HTMLElement;
  title: string;
}

/** A user-chosen sub-region of the page: a picked element, or the active
 * text selection's Range. */
export type Region = Range | Element;

const ELEMENT_NODE = 1;
// Node.DOCUMENT_POSITION_PRECEDING, inlined so core never touches the `Node`
// global. Per the DOM spec an ancestor sets this bit too (CONTAINS|PRECEDING),
// so one flag covers both "contains" and "comes before".
const POSITION_PRECEDING = 2;

function isRange(region: Region): region is Range {
  return typeof (region as Range).cloneContents === "function";
}

/** Wrap a region as the extraction root (cloned — the live DOM is untouched). */
export function selectRegion(
  document: Document,
  region: Region
): SelectedContent {
  const container = document.createElement("div");
  container.appendChild(
    isRange(region) ? region.cloneContents() : region.cloneNode(true)
  );
  return { root: container, title: document.title ?? "" };
}

/**
 * The nearest anchor id for a region: the last element with an id that
 * contains or precedes it in document order — typically the heading a docs
 * site anchors its sections with — so the Source header can deep-link back.
 */
export function anchorIdFor(region: Region): string {
  const start = isRange(region) ? region.startContainer : region;
  const el =
    start.nodeType === ELEMENT_NODE ? (start as Element) : start.parentElement;
  const doc = start.ownerDocument;
  if (!(el && doc)) {
    return "";
  }
  let best = "";
  for (const cand of doc.querySelectorAll("[id]")) {
    const containsOrPrecedes =
      cand === el ||
      // biome-ignore lint/suspicious/noBitwiseOperators: compareDocumentPosition returns a bit mask
      (el.compareDocumentPosition(cand) & POSITION_PRECEDING) !== 0;
    if (cand.id && containsOrPrecedes) {
      best = cand.id;
    }
  }
  return best;
}

/** Pick the content root: author selector → Readability → <main>/<article>/<body>. */
export function selectContent(
  document: Document,
  selector?: string
): SelectedContent {
  const docTitle = document.title ?? "";

  if (selector) {
    const el = document.querySelector(selector);
    if (el) {
      return { root: el.cloneNode(true) as HTMLElement, title: docTitle };
    }
  }

  const article = tryReadability(document);
  if (article) {
    const container = document.createElement("div");
    container.innerHTML = article.content;
    return { root: container, title: article.title || docTitle };
  }

  const fallback =
    document.querySelector("main") ??
    document.querySelector("article") ??
    document.body;
  if (!fallback) {
    // No <body> (e.g. an XML or detached document): return an empty root
    // rather than throwing on cloneNode.
    return { root: document.createElement("div"), title: docTitle };
  }
  return { root: fallback.cloneNode(true) as HTMLElement, title: docTitle };
}

/** Readability mutates the document it parses, so run it on a clone. */
function tryReadability(
  document: Document
): { title: string; content: string } | null {
  try {
    const clone = document.cloneNode(true) as Document;
    const article = new Readability(clone).parse();
    if (!article?.content) {
      return null;
    }
    return { title: article.title ?? "", content: article.content };
  } catch {
    return null;
  }
}
