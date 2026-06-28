import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';

/** Collapse 3+ newlines, strip trailing spaces, trim. */
export function cleanup(md: string): string {
  return md
    .replace(/[ \t]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Convert a DOM node's contents to clean Markdown. */
export function toMarkdown(root: Node): string {
  const td = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
    bulletListMarker: '-',
    hr: '---',
  });
  td.use(gfm);
  // @types/turndown types the arg as string | TurndownService.Node; a DOM node is valid at runtime.
  const md = td.turndown(root as unknown as TurndownService.Node);
  return cleanup(md);
}
