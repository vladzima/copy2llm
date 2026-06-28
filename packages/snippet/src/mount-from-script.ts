import { mount, parseDataset } from "copy2llm-widget";

/**
 * Mount the widget from a `<script data-*>` tag. `script` must be captured during
 * the snippet's synchronous execution (`document.currentScript`), since it is only
 * valid then. If the body is not ready yet, the mount waits for `DOMContentLoaded`.
 */
export function mountFromScript(
  doc: Document,
  script: HTMLScriptElement | null
): void {
  const options = script ? parseDataset(script.dataset) : {};
  const run = () => mount(options, doc.body);

  if (doc.readyState === "loading" || !doc.body) {
    doc.addEventListener("DOMContentLoaded", run, { once: true });
  } else {
    run();
  }
}
