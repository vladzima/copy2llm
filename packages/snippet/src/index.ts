import { DEFAULTS, mount, parseDataset } from "copy2llm-widget";
import { mountFromScript } from "./mount-from-script";

declare global {
  interface Window {
    copy2llm?: {
      mount: typeof mount;
      parseDataset: typeof parseDataset;
      DEFAULTS: typeof DEFAULTS;
    };
  }
}

// `document.currentScript` is only valid during this synchronous execution, so
// capture it now; `mountFromScript` defers the actual mount if the body isn't ready.
const script = document.currentScript as HTMLScriptElement | null;

// Expose a tiny programmatic API so a host page can mount/destroy the widget
// itself (the copy.computer configurator drives a live preview this way).
window.copy2llm = { mount, parseDataset, DEFAULTS };

// Auto-mount from the script's data-* attributes, unless the page opts out with
// `data-automount="false"` to take control of mounting.
if (script?.dataset.automount !== "false") {
  mountFromScript(document, script);
}
