export type LlmTarget = "chatgpt" | "claude" | "perplexity" | "grok";

const BASE: Record<LlmTarget, string> = {
  chatgpt: "https://chatgpt.com/?q=",
  claude: "https://claude.ai/new?q=",
  perplexity: "https://www.perplexity.ai/search?q=",
  grok: "https://grok.com/?q=",
};

// Short lead-in so the auto-submitted first message reads sensibly; the page's
// Markdown (with its own `# Title` / `> Source:` header) follows inline. Site
// owners can replace it via the `prompt` option.
const LEAD = "Here's a web page as Markdown — help me work with it:";
// Used only when the page is too long to fit in the URL: the Markdown is on the
// clipboard instead, ready to paste.
const ASK_PASTE =
  "I've copied a web page to your clipboard as Markdown. Paste it below and help me work with it.";

// Inline the Markdown into the deep link as long as the resulting URL stays
// within what browsers and the chat prefill handle reliably; longer pages fall
// back to a clipboard paste.
// ponytail: 12k-char URL ceiling is a conservative cross-browser + chat-prefill
// guess — raise it if real pages get truncated, lower it if links break.
const MAX_URL = 12_000;

export interface LlmLink {
  href: string;
  /** Markdown didn't fit in the URL — the caller must put it on the clipboard. */
  needsPaste: boolean;
}

// Fill a target's deep-link template with the page's Markdown. `template` either
// carries a `{q}` placeholder (custom endpoints can put the query mid-URL) or
// ends where the encoded query is appended (the built-in `?q=` bases). A
// site-owner `prompt` replaces the default lead-in; blank means unset.
function linkFor(template: string, markdown: string, prompt?: string): LlmLink {
  const put = (s: string): string => {
    const q = encodeURIComponent(s);
    return template.includes("{q}")
      ? template.replaceAll("{q}", q)
      : template + q;
  };
  const lead = prompt?.trim() ? prompt : LEAD;
  const inline = put(`${lead}\n\n${markdown}`);
  if (inline.length <= MAX_URL) {
    return { href: inline, needsPaste: false };
  }
  return { href: put(ASK_PASTE), needsPaste: true };
}

/** Build a built-in target's deep link (ChatGPT/Claude/Perplexity/Grok) that
 * carries the page's Markdown itself. */
export function llmUrl(
  target: LlmTarget,
  markdown: string,
  prompt?: string
): LlmLink {
  return linkFor(BASE[target], markdown, prompt);
}

/** Build a deep link for a site-owner's custom endpoint. `template` is their
 * `hrefTemplate` — a `{q}` placeholder, or a base the encoded query appends to. */
export function customLink(
  template: string,
  markdown: string,
  prompt?: string
): LlmLink {
  return linkFor(template, markdown, prompt);
}
