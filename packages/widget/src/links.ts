export type LlmTarget = "chatgpt" | "claude";

const BASE: Record<LlmTarget, string> = {
  chatgpt: "https://chatgpt.com/?q=",
  claude: "https://claude.ai/new?q=",
};

// Short lead-in so the auto-submitted first message reads sensibly; the page's
// Markdown (with its own `# Title` / `> Source:` header) follows inline.
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

/** Build a ChatGPT/Claude deep link that carries the page's Markdown itself. */
export function llmUrl(target: LlmTarget, markdown: string): LlmLink {
  const inline = BASE[target] + encodeURIComponent(`${LEAD}\n\n${markdown}`);
  if (inline.length <= MAX_URL) {
    return { href: inline, needsPaste: false };
  }
  return {
    href: BASE[target] + encodeURIComponent(ASK_PASTE),
    needsPaste: true,
  };
}
