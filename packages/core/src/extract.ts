import { absolutizeUrls } from "./absolutize";
import { prependHeader } from "./header";
import { selectContent } from "./select-content";
import { toMarkdown } from "./to-markdown";

export interface ExtractOptions {
  /** CSS selector for the content root. Overrides auto-detection. */
  content?: string;
  /** Prepend a title + source header. Default: true. */
  header?: boolean;
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
  const { content, header = true } = options;
  const url = document.baseURI || document.URL || "";

  const { root, title } = selectContent(document, content);
  absolutizeUrls(root, url);
  let markdown = toMarkdown(root);
  if (header) {
    markdown = prependHeader(markdown, title, url);
  }

  return { markdown, title, url };
}
