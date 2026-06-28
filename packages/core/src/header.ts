/** Prepend a 2-line header (title + source URL). Either line is omitted if empty. */
export function prependHeader(markdown: string, title: string, url: string): string {
  const parts: string[] = [];
  if (title) parts.push(`# ${title}`);
  if (url) parts.push(`> Source: ${url}`);
  if (parts.length === 0) return markdown;
  return `${parts.join('\n\n')}\n\n${markdown}`;
}
