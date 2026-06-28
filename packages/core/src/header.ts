/** Prepend a 2-line header (title + source URL). Either line is omitted if empty. */
export function prependHeader(
  markdown: string,
  title: string,
  url: string
): string {
  const parts: string[] = [];
  if (title) {
    parts.push(`# ${title}`);
  }
  if (url) {
    parts.push(`> Source: ${url}`);
  }
  const head = parts.join("\n\n");
  if (!head) {
    return markdown;
  }
  // No body to attach: return the header alone, without a dangling separator.
  if (markdown.trim() === "") {
    return head;
  }
  return `${head}\n\n${markdown}`;
}
