export type LlmTarget = "chatgpt" | "claude";

const BASE: Record<LlmTarget, string> = {
  chatgpt: "https://chatgpt.com/?q=",
  claude: "https://claude.ai/new?q=",
};

const ASK = "Please read this page and help me work with its content.";

// localhost / loopback / RFC-1918 LAN ranges / IPv6 loopback / mDNS .local
const PRIVATE_HOST =
  /^(?:localhost|127\.\d+\.\d+\.\d+|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(?:1[6-9]|2\d|3[01])\.\d+\.\d+|\[::1\]|.*\.local)$/i;

/**
 * Heuristic: can a remote LLM fetch this URL? False for localhost, LAN, `.local`,
 * single-label intranet hosts, and non-http(s) schemes. Used to decide whether to
 * deep-link the page URL or rely on the pre-copied clipboard.
 */
export function isPublicUrl(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return false;
  }
  const host = url.hostname.toLowerCase();
  if (PRIVATE_HOST.test(host)) {
    return false;
  }
  // A host with no dot (e.g. `intranet`) is not publicly resolvable.
  return host.includes(".");
}

/** Build a ChatGPT/Claude deep link. Public pages pass the URL; others point at the clipboard. */
export function llmUrl(
  target: LlmTarget,
  pageUrl: string,
  isPublic: boolean
): string {
  const prompt = isPublic
    ? `${ASK}\n\n${pageUrl}`
    : `${ASK}\n\nThe page has been copied to your clipboard as Markdown — please paste it below.`;
  return BASE[target] + encodeURIComponent(prompt);
}
