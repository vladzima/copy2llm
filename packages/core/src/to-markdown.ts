import TurndownService from "turndown";
import { gfm } from "turndown-plugin-gfm";

const FENCED_BLOCK = /(```[\s\S]*?```)/g;
const TRAILING_WS = /[ \t]+$/gm;
const EXTRA_BLANK_LINES = /\n{3,}/g;
const DATA_URI = /^\s*data:/i;
const DATA_URI_MEDIA = /^\s*data:([^;,]*)/i;
const PIPE = /\|/g;
const NEWLINES = /\n+/g;

/**
 * Collapse 3+ newlines and strip trailing spaces, but leave the contents of
 * fenced code blocks untouched (whitespace there is significant).
 */
export function cleanup(md: string): string {
  const segments = md.split(FENCED_BLOCK);
  const cleaned = segments
    .map((segment, i) => {
      // Odd segments are fenced code blocks (the capture group) — leave as-is.
      if (i % 2 === 1) {
        return segment;
      }
      return segment
        .replace(TRAILING_WS, "")
        .replace(EXTRA_BLANK_LINES, "\n\n");
    })
    .join("");
  return cleaned.trim();
}

/** True for a `data:` URI (case-insensitive, ignoring leading whitespace). */
function isDataUri(value: string): boolean {
  return DATA_URI.test(value);
}

/** Build a short placeholder for a stripped `data:` URI, preserving its media type. */
function dataUriPlaceholder(value: string): string {
  const match = DATA_URI_MEDIA.exec(value);
  const mediaType = match?.[1] ?? "";
  return mediaType ? `data:${mediaType}` : "data:";
}

/** Cells of a `<tr>`, as Markdown-escaped pipe-safe text. */
function rowCells(tr: Element): string[] {
  return Array.from(tr.children).map((cell) =>
    (cell.textContent ?? "").replace(PIPE, "\\|").replace(NEWLINES, " ").trim()
  );
}

/**
 * Pad ragged table rows with empty cells so every row matches the widest row.
 * Prevents column-count mismatches that produce structurally-invalid GFM (a
 * separator row of N columns with body rows of fewer/more cells). Lossless: only
 * pads short rows, never truncates.
 */
export function normalizeTables(root: Element): void {
  for (const table of Array.from(root.querySelectorAll("table"))) {
    const rows = Array.from((table as HTMLTableElement).rows);
    if (rows.length === 0) {
      continue;
    }
    const maxCols = Math.max(...rows.map((row) => row.cells.length));
    for (const row of rows) {
      while (row.cells.length < maxCols) {
        row.appendChild(row.ownerDocument.createElement("td"));
      }
    }
  }
}

function configure(td: TurndownService): void {
  td.use(gfm);

  // Drop non-content elements entirely. This matters most for the author
  // selector path, which bypasses Readability's cleanup, but is harmless and
  // correct for every path.
  td.remove(["script", "style", "noscript", "template"]);

  // Replace giant `data:` URIs (e.g. inline base64 images) with a short
  // placeholder so a single embedded image cannot balloon the output.
  td.addRule("dataUriImage", {
    filter: (node) =>
      node.nodeName === "IMG" && isDataUri(node.getAttribute("src") ?? ""),
    replacement: (_content, node) => {
      const el = node as unknown as Element;
      const alt = (el.getAttribute("alt") ?? "").replace(NEWLINES, " ").trim();
      const placeholder = dataUriPlaceholder(el.getAttribute("src") ?? "");
      return `![${alt}](${placeholder})`;
    },
  });

  // GFM only converts tables that have a heading row; header-less tables
  // (all <td>) otherwise leak raw <table> HTML. Convert them by treating the
  // first row as the header. Registered after gfm so it takes precedence.
  td.addRule("headerlessTable", {
    filter: (node) => {
      if (node.nodeName !== "TABLE") {
        return false;
      }
      const table = node as unknown as HTMLTableElement;
      const firstRow = table.rows[0];
      if (!firstRow) {
        return false;
      }
      // Already-headed tables are handled by gfm; only claim header-less ones.
      return !Array.from(firstRow.cells).every((c) => c.nodeName === "TH");
    },
    replacement: (_content, node) => {
      const table = node as unknown as HTMLTableElement;
      const rows = Array.from(table.rows);
      if (rows.length === 0) {
        return "";
      }
      const lines = rows.map((tr) => `| ${rowCells(tr).join(" | ")} |`);
      const colCount = Array.from(rows[0]?.cells ?? []).length;
      const divider = `| ${new Array(colCount).fill("---").join(" | ")} |`;
      const [header, ...body] = lines;
      return `\n\n${[header, divider, ...body].join("\n")}\n\n`;
    },
  });
}

/** Convert a DOM node's contents to clean Markdown. */
export function toMarkdown(root: Node): string {
  const td = new TurndownService({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
    bulletListMarker: "-",
    hr: "---",
  });
  configure(td);
  // @types/turndown types the arg as string | TurndownService.Node; a DOM node is valid at runtime.
  const md = td.turndown(root as unknown as TurndownService.Node);
  return cleanup(md);
}
