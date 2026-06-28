import { Readability } from '@mozilla/readability';

export interface SelectedContent {
  root: HTMLElement;
  title: string;
}

/** Pick the content root: author selector → Readability → <main>/<article>/<body>. */
export function selectContent(document: Document, selector?: string): SelectedContent {
  const docTitle = document.title ?? '';

  if (selector) {
    const el = document.querySelector(selector);
    if (el) return { root: el.cloneNode(true) as HTMLElement, title: docTitle };
  }

  const article = tryReadability(document);
  if (article) {
    const container = document.createElement('div');
    container.innerHTML = article.content;
    return { root: container, title: article.title || docTitle };
  }

  const fallback =
    document.querySelector('main') ?? document.querySelector('article') ?? document.body;
  return { root: fallback.cloneNode(true) as HTMLElement, title: docTitle };
}

/** Readability mutates the document it parses, so run it on a clone. */
function tryReadability(document: Document): { title: string; content: string } | null {
  try {
    const clone = document.cloneNode(true) as Document;
    const article = new Readability(clone).parse();
    if (!article?.content) return null;
    return { title: article.title ?? '', content: article.content };
  } catch {
    return null;
  }
}
