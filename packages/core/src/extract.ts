import { absolutizeUrls, promoteLazyImages } from "./absolutize";
import { prependHeader } from "./header";
import {
  anchorIdFor,
  type Region,
  selectContent,
  selectRegion,
} from "./select-content";
import { normalizeTables, toMarkdown } from "./to-markdown";

export interface ExtractOptions {
  /** CSS selector for the content root. Overrides auto-detection. */
  content?: string;
  /** CSS selectors to remove from the extracted clone. Invalid selectors are ignored. */
  exclude?: string;
  /** Prepend a title + source header. Default: true. */
  header?: boolean;
  /** Extract only this region — a picked element or the user's selection
   * Range — instead of the detected page root. The source URL gains a
   * #anchor deep link back to the section when one can be found. */
  region?: Region;
}

export interface ExtractResult {
  markdown: string;
  title: string;
  url: string;
}

/** Convert a DOM into clean Markdown. Does not mutate the passed document. */
export function extract(
  document: Document,
  options: ExtractOptions = {}
): ExtractResult {
  const { content, exclude, header = true, region } = options;
  let url = document.baseURI || document.URL || "";

  // Readability can discard author classes/data attributes. Remove exclusions
  // from a document clone before it runs so auto-detection cannot reintroduce
  // content that should never leave the page.
  const extractionDocument = region
    ? document
    : (document.cloneNode(true) as Document);
  if (!region && extractionDocument.documentElement) {
    removeExcluded(
      extractionDocument.documentElement,
      "[data-copy2llm-ignore]"
    );
    if (exclude) {
      removeExcluded(extractionDocument.documentElement, exclude);
    }
  }

  const { root, title } = region
    ? selectRegion(document, region)
    : selectContent(extractionDocument, content);
  removeExcluded(root, "[data-copy2llm-ignore]");
  if (exclude) {
    removeExcluded(root, exclude);
  }
  if (region && url) {
    const id = anchorIdFor(region);
    if (id) {
      // Deep-link the Source header to the section the region came from.
      url = `${url.split("#")[0]}#${id}`;
    }
  }
  promoteLazyImages(root);
  normalizeTables(root);
  absolutizeUrls(root, url);
  let markdown = toMarkdown(root);
  if (header) {
    markdown = prependHeader(markdown, title, url);
  }

  return { markdown, title, url };
}

/** Remove matching nodes from the cloned extraction root without ever making a
 * malformed author selector break the extraction. */
function removeExcluded(root: HTMLElement, selector: string): void {
  try {
    if (root.matches(selector)) {
      root.replaceChildren();
      return;
    }
    for (const node of root.querySelectorAll(selector)) {
      node.remove();
    }
  } catch {
    // Invalid selectors are configuration mistakes, not extraction failures.
  }
}
