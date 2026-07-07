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
  const { content, header = true, region } = options;
  let url = document.baseURI || document.URL || "";

  const { root, title } = region
    ? selectRegion(document, region)
    : selectContent(document, content);
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
