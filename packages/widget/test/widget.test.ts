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

test("primary Copy writes the extracted markdown and shows a toast", async () => {
  const { doc, writes } = page("<main><h1>Hello</h1><p>World</p></main>");
  mount({}, doc.body);
  (q(doc, ".primary") as HTMLButtonElement).click();
  await tick();
  expect(writes.length).toBe(1);
  expect(writes[0]).toContain("World");
  expect(q(doc, ".toast").hasAttribute("hidden")).toBe(false);
});

test("caret opens the menu; Open in ChatGPT deep-links and copies", async () => {
  const { doc, opened, writes } = page("<main><p>hi there friend</p></main>");
  mount({}, doc.body);
  const caret = q(doc, ".caret") as HTMLButtonElement;
  caret.click();
  expect(caret.getAttribute("aria-expanded")).toBe("true");
  (q(doc, '[data-action="chatgpt"]') as HTMLButtonElement).click();
  await tick();
  expect(opened[0]?.startsWith("https://chatgpt.com/?q=")).toBe(true);
  expect(writes.length).toBe(1);
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

test("non-public page: deep link omits the URL and toasts to paste", async () => {
  const { doc, opened } = page(
    "<main><p>secret staging content</p></main>",
    "http://localhost:3000/x"
  );
  mount({}, doc.body);
  (q(doc, ".caret") as HTMLButtonElement).click();
  (q(doc, '[data-action="claude"]') as HTMLButtonElement).click();
  await tick();
  expect(opened[0]?.startsWith("https://claude.ai/new?q=")).toBe(true);
  expect(decodeURIComponent(opened[0] ?? "")).not.toContain("localhost");
  expect(q(doc, ".toast").textContent?.toLowerCase()).toContain("paste");
});

test("empty extraction toasts a failure and opens the overlay", async () => {
  const { doc } = page('<div id="empty"></div>');
  mount({ content: "#empty", header: false }, doc.body);
  (q(doc, ".primary") as HTMLButtonElement).click();
  await tick();
  expect(q(doc, ".overlay").hasAttribute("hidden")).toBe(false);
  expect(q(doc, ".toast").textContent).toContain("extract");
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
