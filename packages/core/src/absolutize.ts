const WHITESPACE = /\s+/;
const LAZY_SRC_ATTRS = ["data-src", "data-original", "data-lazy-src"];

/** Rewrite relative <a href> and <img src> under `root` to absolute URLs. Mutates in place. */
export function absolutizeUrls(root: Element, baseUrl: string): void {
  if (!baseUrl) {
    return;
  }

  const resolve = (value: string): string | null => {
    try {
      return new URL(value, baseUrl).href;
    } catch {
      return null;
    }
  };

  const rewrite = (selector: string, attr: "href" | "src") => {
    for (const el of Array.from(root.querySelectorAll(selector))) {
      const value = el.getAttribute(attr);
      if (!value) {
        continue;
      }
      const abs = resolve(value);
      if (abs) {
        el.setAttribute(attr, abs);
      }
    }
  };

  rewrite("a[href]", "href");
  rewrite("img[src]", "src");
}

/**
 * Promote lazy-loaded image attributes (data-src, data-original, srcset, …) to
 * `src` so the image survives conversion on every path. Readability already does
 * this on its path; this keeps the author-selector and fallback paths consistent.
 */
export function promoteLazyImages(root: Element): void {
  for (const img of Array.from(root.querySelectorAll("img"))) {
    const current = img.getAttribute("src");
    if (current && current.trim() !== "") {
      continue;
    }

    for (const attr of LAZY_SRC_ATTRS) {
      const value = img.getAttribute(attr);
      if (value && value.trim() !== "") {
        img.setAttribute("src", value);
        break;
      }
    }
    if (img.getAttribute("src")) {
      continue;
    }

    const srcset = img.getAttribute("srcset");
    if (srcset) {
      const first = srcset.split(",")[0]?.trim().split(WHITESPACE)[0];
      if (first) {
        img.setAttribute("src", first);
      }
    }
  }
}
