import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';

/**
 * Collapse 3+ newlines and strip trailing spaces, but leave the contents of
 * fenced code blocks untouched (whitespace there is significant).
 */
export function cleanup(md: string): string {
  const segments = md.split(/(```[\s\S]*?```)/g);
  const cleaned = segments
    .map((segment, i) => {
      // Odd segments are fenced code blocks (the capture group) — leave as-is.
      if (i % 2 === 1) return segment;
      return segment.replace(/[ \t]+$/gm, '').replace(/\n{3,}/g, '\n\n');
    })
    .join('');
  return cleaned.trim();
}

/** True for a `data:` URI (case-insensitive, ignoring leading whitespace). */
function isDataUri(value: string): boolean {
  return /^\s*data:/i.test(value);
}

/** Build a short placeholder for a stripped `data:` URI, preserving its media type. */
function dataUriPlaceholder(value: string): string {
  const match = /^\s*data:([^;,]*)/i.exec(value);
  const mediaType = match?.[1] ?? '';
  return mediaType ? `data:${mediaType}` : 'data:';
}

/** Cells of a `<tr>`, as Markdown-escaped pipe-safe text. */
function rowCells(tr: Element): string[] {
  return Array.from(tr.children).map((cell) =>
    (cell.textContent ?? '').replace(/\|/g, '\\|').replace(/\n+/g, ' ').trim(),
  );
}

function configure(td: TurndownService): void {
  td.use(gfm);

  // Drop non-content elements entirely. This matters most for the author
  // selector path, which bypasses Readability's cleanup, but is harmless and
  // correct for every path.
  td.remove(['script', 'style', 'noscript', 'template']);

  // Replace giant `data:` URIs (e.g. inline base64 images) with a short
  // placeholder so a single embedded image cannot balloon the output.
  td.addRule('dataUriImage', {
    filter: (node) =>
      node.nodeName === 'IMG' && isDataUri(node.getAttribute('src') ?? ''),
    replacement: (_content, node) => {
      const el = node as unknown as Element;
      const alt = (el.getAttribute('alt') ?? '').replace(/\n+/g, ' ').trim();
      const placeholder = dataUriPlaceholder(el.getAttribute('src') ?? '');
      return `![${alt}](${placeholder})`;
    },
  });

  // GFM only converts tables that have a heading row; header-less tables
  // (all <td>) otherwise leak raw <table> HTML. Convert them by treating the
  // first row as the header. Registered after gfm so it takes precedence.
  td.addRule('headerlessTable', {
    filter: (node) => {
      if (node.nodeName !== 'TABLE') return false;
      const table = node as unknown as HTMLTableElement;
      const firstRow = table.rows[0];
      if (!firstRow) return false;
      // Already-headed tables are handled by gfm; only claim header-less ones.
      return !Array.from(firstRow.cells).every((c) => c.nodeName === 'TH');
    },
    replacement: (_content, node) => {
      const table = node as unknown as HTMLTableElement;
      const rows = Array.from(table.rows);
      if (rows.length === 0) return '';
      const lines = rows.map((tr) => `| ${rowCells(tr).join(' | ')} |`);
      const colCount = Array.from(rows[0]?.cells ?? []).length;
      const divider = `| ${Array(colCount).fill('---').join(' | ')} |`;
      const [header, ...body] = lines;
      return `\n\n${[header, divider, ...body].join('\n')}\n\n`;
    },
  });
}

/** Convert a DOM node's contents to clean Markdown. */
export function toMarkdown(root: Node): string {
  const td = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
    bulletListMarker: '-',
    hr: '---',
  });
  configure(td);
  // @types/turndown types the arg as string | TurndownService.Node; a DOM node is valid at runtime.
  const md = td.turndown(root as unknown as TurndownService.Node);
  return cleanup(md);
}
