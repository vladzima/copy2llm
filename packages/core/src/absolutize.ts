/** Rewrite relative <a href> and <img src> under `root` to absolute URLs. Mutates in place. */
export function absolutizeUrls(root: Element, baseUrl: string): void {
  if (!baseUrl) return;

  const resolve = (value: string): string | null => {
    try {
      return new URL(value, baseUrl).href;
    } catch {
      return null;
    }
  };

  const rewrite = (selector: string, attr: 'href' | 'src') => {
    for (const el of Array.from(root.querySelectorAll(selector))) {
      const value = el.getAttribute(attr);
      if (!value) continue;
      const abs = resolve(value);
      if (abs) el.setAttribute(attr, abs);
    }
  };

  rewrite('a[href]', 'href');
  rewrite('img[src]', 'src');
}
