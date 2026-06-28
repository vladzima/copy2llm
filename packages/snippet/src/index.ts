import { mountFromScript } from "./mount-from-script";

// `document.currentScript` is only valid during this synchronous execution, so
// capture it now; `mountFromScript` defers the actual mount if the body isn't ready.
mountFromScript(document, document.currentScript as HTMLScriptElement | null);
