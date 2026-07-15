import { expect, test } from "bun:test";
import { JSDOM } from "jsdom";
import { mount } from "../src/widget";

type Any = any;

function page(html: string, url = "https://example.com/p") {
  const jd = new JSDOM(
    `<!DOCTYPE html><html><head><title>T</title></head><body>${html}</body></html>`,
    { url }
  );
  const win = jd.window as Any;
  win.document.execCommand = () => true;
  const opened: string[] = [];
  win.open = (u: string) => {
    opened.push(u);
    return null;
  };
  const writes: string[] = [];
  win.navigator.clipboard = {
    writeText: (t: string) => {
      writes.push(t);
      return Promise.resolve();
    },
  };
  return { win, doc: win.document as Document, opened, writes };
}

const tick = () => new Promise((r) => setTimeout(r, 0));
const hostOf = (doc: Document) =>
  doc.body.querySelector("[data-copy2llm]") as HTMLElement;
const shadowOf = (doc: Document) => hostOf(doc).shadowRoot as ShadowRoot;
const q = (doc: Document, sel: string) =>
  shadowOf(doc).querySelector(sel) as HTMLElement;

test("mounts one host with a shadow root and the primary button", () => {
  const { doc } = page("<main><p>hi</p></main>");
  mount({}, doc.body);
  expect(doc.body.querySelectorAll("[data-copy2llm]").length).toBe(1);
  expect(q(doc, ".primary").textContent).toBe("Copy as Markdown");
});

test("mount is idempotent on the same target", () => {
  const { doc } = page("<main><p>hi</p></main>");
  mount({}, doc.body);
  mount({}, doc.body);
  expect(doc.body.querySelectorAll("[data-copy2llm]").length).toBe(1);
});

test("primary Copy writes the markdown and flashes the button label (no side toast)", async () => {
  const { doc, writes } = page("<main><h1>Hello</h1><p>World</p></main>");
  mount({}, doc.body);
  (q(doc, ".primary") as HTMLButtonElement).click();
  await tick();
  expect(writes.length).toBe(1);
  expect(writes[0]).toContain("World");
  // Feedback lives on the button itself now, not the toast beside it.
  expect(q(doc, ".primary").textContent).toContain("Copied");
  expect(q(doc, ".toast").hasAttribute("hidden")).toBe(true);
});

test("caret opens the menu; Open in ChatGPT inlines the markdown, no clipboard", async () => {
  const { doc, opened, writes } = page("<main><p>hi there friend</p></main>");
  mount({}, doc.body);
  const caret = q(doc, ".caret") as HTMLButtonElement;
  caret.click();
  expect(caret.getAttribute("aria-expanded")).toBe("true");
  (q(doc, '[data-action="chatgpt"]') as HTMLButtonElement).click();
  await tick();
  expect(opened[0]?.startsWith("https://chatgpt.com/?q=")).toBe(true);
  // The page content rides in the URL, not the clipboard — so no write fires
  // (it's the post-open write that triggered Chrome's permission prompt).
  expect(decodeURIComponent(opened[0] ?? "")).toContain("hi there friend");
  expect(writes.length).toBe(0);
});

test("Open in Perplexity inlines the markdown into its ?q= base", () => {
  const { doc, opened } = page("<main><p>perplexity body here</p></main>");
  mount({}, doc.body);
  (q(doc, ".caret") as HTMLButtonElement).click();
  (q(doc, '[data-action="perplexity"]') as HTMLButtonElement).click();
  expect(opened[0]?.startsWith("https://www.perplexity.ai/search?q=")).toBe(
    true
  );
  expect(decodeURIComponent(opened[0] ?? "")).toContain("perplexity body here");
});

test("a custom endpoint renders in the menu and opens its hrefTemplate", () => {
  const { doc, opened } = page("<main><p>custom body here</p></main>");
  mount(
    {
      items: ["copy"],
      endpoints: [{ label: "Acme AI", href: "https://acme.ai/?q={q}" }],
    },
    doc.body
  );
  // A custom endpoint alone is enough to warrant the caret + menu.
  const caret = q(doc, ".caret") as HTMLButtonElement;
  expect(caret).not.toBeNull();
  caret.click();
  const item = q(doc, '[data-action="endpoint"]') as HTMLButtonElement;
  expect(item.textContent).toContain("Acme AI");
  item.click();
  expect(opened[0]?.startsWith("https://acme.ai/?q=")).toBe(true);
  expect(decodeURIComponent(opened[0] ?? "")).toContain("custom body here");
});

test("View opens an overlay containing the markdown", async () => {
  const { doc } = page("<main><p>Body text here</p></main>");
  mount({}, doc.body);
  (q(doc, ".caret") as HTMLButtonElement).click();
  (q(doc, '[data-action="view"]') as HTMLButtonElement).click();
  await tick();
  const overlay = q(doc, ".overlay");
  expect(overlay.hasAttribute("hidden")).toBe(false);
  expect(overlay.querySelector("pre")?.textContent).toContain("Body text here");
});

test("a single configured action renders no caret or menu", () => {
  const { doc } = page("<main><p>hi</p></main>");
  mount({ items: ["copy"] }, doc.body);
  expect(shadowOf(doc).querySelector(".caret")).toBeNull();
  expect(shadowOf(doc).querySelector(".menu")).toBeNull();
});

test("a page too long to inline falls back to clipboard + paste toast", async () => {
  const long = `<main><p>${"word ".repeat(4000)}</p></main>`;
  const { doc, opened } = page(long);
  mount({}, doc.body);
  (q(doc, ".caret") as HTMLButtonElement).click();
  (q(doc, '[data-action="claude"]') as HTMLButtonElement).click();
  await tick();
  expect(opened[0]?.startsWith("https://claude.ai/new?q=")).toBe(true);
  // The huge body is on the clipboard, not in the URL.
  expect(decodeURIComponent(opened[0] ?? "")).not.toContain("word word word");
  expect(q(doc, ".toast").textContent?.toLowerCase()).toContain("paste");
});

test("a failed long-page clipboard fallback opens the Markdown preview instead of an empty chat", () => {
  const long = `<main><p>${"word ".repeat(4000)}</p></main>`;
  const { doc, opened } = page(long);
  (doc as Any).execCommand = () => false;
  mount({}, doc.body);
  (q(doc, ".caret") as HTMLButtonElement).click();
  (q(doc, '[data-action="claude"]') as HTMLButtonElement).click();
  expect(opened).toHaveLength(0);
  expect(q(doc, ".overlay").hasAttribute("hidden")).toBe(false);
  expect(q(doc, ".toast").textContent).toContain("copy automatically");
});

test("empty extraction toasts a failure and opens the overlay", async () => {
  const { doc } = page('<div id="empty"></div>');
  mount({ content: "#empty", header: false }, doc.body);
  (q(doc, ".primary") as HTMLButtonElement).click();
  await tick();
  expect(q(doc, ".overlay").hasAttribute("hidden")).toBe(false);
  expect(q(doc, ".toast").textContent).toContain("extract");
});

test("reveals the button even without requestAnimationFrame (no permanent invisibility)", () => {
  const { doc } = page("<main><p>hi</p></main>");
  mount({}, doc.body);
  expect(q(doc, ".root").classList.contains("c2l-in")).toBe(true);
});

test("honors the active text selection: copies just it, with an anchored source", async () => {
  const { doc, win, writes } = page(
    '<main><h2 id="alpha">Alpha</h2><p>First part.</p>' +
      '<h2 id="beta">Beta</h2><p>Second part.</p></main>'
  );
  mount({}, doc.body);
  const target = doc.querySelectorAll("p")[1] as HTMLElement;
  const range = doc.createRange();
  range.selectNodeContents(target);
  const sel = win.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
  (q(doc, ".primary") as HTMLButtonElement).click();
  await tick();
  expect(writes[0]).toContain("Second part.");
  expect(writes[0]).not.toContain("First part.");
  expect(writes[0]).toContain("> Source: https://example.com/p#beta");
});

test("primary label flips to 'Copy selected' with a selection, and back", () => {
  const { doc, win } = page("<main><p>Some words to select.</p></main>");
  mount({}, doc.body);
  const label = q(doc, ".primary .c2l-label");
  expect(label.textContent).toBe("Copy as Markdown");

  const range = doc.createRange();
  range.selectNodeContents(doc.querySelector("p") as HTMLElement);
  const sel = win.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
  doc.dispatchEvent(new win.Event("selectionchange"));
  expect(label.textContent).toBe("Copy selected");

  sel.removeAllRanges();
  doc.dispatchEvent(new win.Event("selectionchange"));
  expect(label.textContent).toBe("Copy as Markdown");
});

test("pick mode: clicking a block copies just that block, then exits", async () => {
  const { doc, writes } = page(
    '<main><h2 id="one">One</h2><p>Alpha block.</p><p>Beta block.</p></main>'
  );
  mount({}, doc.body);
  (q(doc, ".caret") as HTMLButtonElement).click();
  (q(doc, '[data-action="pick"]') as HTMLButtonElement).click();
  // Pick mode is live: crosshair style + highlight box are in the page.
  expect(doc.head.querySelectorAll("style").length).toBe(1);
  (doc.querySelectorAll("p")[1] as HTMLElement).click();
  await tick();
  expect(writes.length).toBe(1);
  expect(writes[0]).toContain("Beta block.");
  expect(writes[0]).not.toContain("Alpha block.");
  expect(writes[0]).toContain("> Source: https://example.com/p#one");
  // Pick mode tore itself down: another click copies nothing.
  expect(doc.head.querySelectorAll("style").length).toBe(0);
  (doc.querySelectorAll("p")[0] as HTMLElement).click();
  await tick();
  expect(writes.length).toBe(1);
});

test("pick mode: Escape cancels without copying", async () => {
  const { doc, win, writes } = page("<main><p>Some block.</p></main>");
  mount({}, doc.body);
  (q(doc, ".caret") as HTMLButtonElement).click();
  (q(doc, '[data-action="pick"]') as HTMLButtonElement).click();
  doc.dispatchEvent(new win.KeyboardEvent("keydown", { key: "Escape" }));
  expect(doc.head.querySelectorAll("style").length).toBe(0);
  (doc.querySelector("p") as HTMLElement).click();
  await tick();
  expect(writes.length).toBe(0);
});

test("destroy removes the host", () => {
  const { doc } = page("<main><p>hi</p></main>");
  const handle = mount({}, doc.body);
  handle.destroy();
  expect(doc.body.querySelector("[data-copy2llm]")).toBeNull();
});

test("does not leak its own button text into the extracted markdown", async () => {
  const { doc, writes } = page("<main><p>Real article content.</p></main>");
  mount({}, doc.body);
  (q(doc, ".primary") as HTMLButtonElement).click();
  await tick();
  expect(writes[0]).toContain("Real article content.");
  expect(writes[0]).not.toContain("Copy as Markdown");
});

test("Open in ChatGPT opens the tab synchronously, before awaiting the clipboard", () => {
  const { doc, win, opened } = page("<main><p>hello world content</p></main>");
  // A clipboard write that never resolves must NOT delay window.open (WebKit
  // blocks popups opened after an await — user activation is lost).
  (win.navigator as Any).clipboard = {
    writeText: () => new Promise<void>(() => undefined),
  };
  mount({}, doc.body);
  (q(doc, ".caret") as HTMLButtonElement).click();
  (q(doc, '[data-action="chatgpt"]') as HTMLButtonElement).click();
  // No await: assert the tab opened within the synchronous click.
  expect(opened[0]?.startsWith("https://chatgpt.com/?q=")).toBe(true);
});

test("a second mount on the same target returns an inert handle", () => {
  const { doc } = page("<main><p>hi</p></main>");
  mount({}, doc.body);
  const second = mount({}, doc.body);
  second.destroy();
  // destroying the second (inert) handle must not remove the first widget
  expect(doc.body.querySelector("[data-copy2llm]")).not.toBeNull();
});

test("clicking the primary button closes an open menu", () => {
  const { doc } = page("<main><p>hi</p></main>");
  mount({}, doc.body);
  (q(doc, ".caret") as HTMLButtonElement).click();
  expect(q(doc, ".menu").hasAttribute("hidden")).toBe(false);
  (q(doc, ".primary") as HTMLButtonElement).click();
  expect(q(doc, ".menu").hasAttribute("hidden")).toBe(true);
});

test("the overlay markdown body is keyboard-focusable (scrollable)", async () => {
  const { doc } = page("<main><p>long content here</p></main>");
  mount({}, doc.body);
  (q(doc, ".caret") as HTMLButtonElement).click();
  (q(doc, '[data-action="view"]') as HTMLButtonElement).click();
  await tick();
  expect(
    q(doc, ".overlay").querySelector("pre")?.getAttribute("tabindex")
  ).toBe("0");
});

test("Context adds the page, persists it, and copies a reviewed Markdown bundle", async () => {
  const { doc, writes } = page(
    "<main><h1>Guide</h1><p>Context body.</p></main>"
  );
  const first = mount({}, doc.body);
  (q(doc, ".caret") as HTMLButtonElement).click();
  (q(doc, '[data-action="context"]') as HTMLButtonElement).click();

  expect(q(doc, ".context-status").textContent).toBe("Context 1");
  expect(q(doc, ".context-status").hasAttribute("hidden")).toBe(false);
  expect(q(doc, ".context-overlay").hasAttribute("hidden")).toBe(false);
  expect(q(doc, ".context-list").textContent).toContain("T");
  expect(q(doc, ".context-list").textContent).toContain("example.com/p");
  expect(
    Array.from(
      shadowOf(doc).querySelectorAll(".context-footer-label"),
      (label) => label.textContent
    )
  ).toEqual(["Add sources", "Export", "Send to AI"]);
  expect(
    Array.from(
      shadowOf(doc).querySelectorAll(".context-target .c2l-label"),
      (label) => label.textContent
    )
  ).toEqual(["ChatGPT", "Claude", "Perplexity", "Grok"]);
  expect(
    Array.from(
      shadowOf(doc).querySelectorAll(".context-sheet footer button")
    ).every((button) => button.querySelector(".c2l-ic"))
  ).toBe(true);

  (q(doc, ".context-copy") as HTMLButtonElement).click();
  await tick();
  expect(writes.at(-1)).toContain("# AI context");
  expect(writes.at(-1)).toContain("> Source: https://example.com/p");
  expect(writes.at(-1)).toContain("Context body.");

  first.destroy();
  mount({}, doc.body);
  expect(q(doc, ".context-status").textContent).toBe("Context 1");
});

test("Context can add a picked section and remove it from review", () => {
  const { doc } = page(
    '<main><h2 id="one">One</h2><p>First.</p><p>Second.</p></main>'
  );
  mount({}, doc.body);
  (q(doc, ".caret") as HTMLButtonElement).click();
  (q(doc, '[data-action="context"]') as HTMLButtonElement).click();
  (q(doc, ".context-add-section") as HTMLButtonElement).click();
  (doc.querySelectorAll("p")[1] as HTMLElement).click();

  expect(q(doc, ".context-status").textContent).toBe("Context 2");
  const rows = shadowOf(doc).querySelectorAll(".context-source");
  expect(rows[1]?.textContent).toContain("section");
  (rows[1]?.querySelector(".context-remove") as HTMLButtonElement).click();
  expect(q(doc, ".context-status").textContent).toBe("Context 1");
});

test("Context review restores focus and reports AI handoff as context-send", () => {
  const { doc, opened } = page("<main><p>Context handoff.</p></main>");
  const events: Any[] = [];
  mount({ onEvent: (detail) => events.push(detail) }, doc.body);
  (q(doc, ".caret") as HTMLButtonElement).click();
  (q(doc, '[data-action="context"]') as HTMLButtonElement).click();

  (q(doc, ".context-close") as HTMLButtonElement).click();
  const status = q(doc, ".context-status") as HTMLButtonElement;
  expect(shadowOf(doc).activeElement).toBe(status);

  status.click();
  (q(doc, ".context-target") as HTMLButtonElement).click();
  expect(opened[0]?.startsWith("https://chatgpt.com/?q=")).toBe(true);
  expect(events.at(-1)).toMatchObject({
    action: "context-send",
    items: 1,
    success: true,
    target: "chatgpt",
  });
});

test("exclude is applied by the widget extraction path", async () => {
  const { doc, writes } = page(
    '<main><p>Public.</p><p class="private">Private.</p></main>'
  );
  mount({ exclude: ".private", items: ["copy"] }, doc.body);
  (q(doc, ".primary") as HTMLButtonElement).click();
  await tick();
  expect(writes[0]).toContain("Public.");
  expect(writes[0]).not.toContain("Private.");
});

test("dispatches privacy-safe action events and calls onEvent", async () => {
  const { doc } = page("<main><p>Private event payload test.</p></main>");
  const domEvents: Any[] = [];
  const callbacks: Any[] = [];
  doc.body.addEventListener("copy2llm:action", (event) => {
    domEvents.push((event as CustomEvent).detail);
  });
  mount(
    { items: ["copy"], onEvent: (detail) => callbacks.push(detail) },
    doc.body
  );
  (q(doc, ".primary") as HTMLButtonElement).click();
  await tick();

  expect(domEvents).toHaveLength(1);
  expect(callbacks).toEqual(domEvents);
  expect(domEvents[0]).toMatchObject({ action: "copy", success: true });
  expect(domEvents[0].characters).toBeGreaterThan(0);
  expect(JSON.stringify(domEvents[0])).not.toContain(
    "Private event payload test"
  );
  expect(JSON.stringify(domEvents[0])).not.toContain("https://example.com");
});

test("a thrown window.open falls back to the Markdown preview", () => {
  const { doc, win } = page("<main><p>Handoff body.</p></main>");
  win.open = () => {
    throw new Error("blocked");
  };
  mount({}, doc.body);
  (q(doc, ".caret") as HTMLButtonElement).click();
  (q(doc, '[data-action="chatgpt"]') as HTMLButtonElement).click();
  expect(q(doc, ".overlay").hasAttribute("hidden")).toBe(false);
  expect(q(doc, ".toast").textContent).toContain("open the chat");
});
