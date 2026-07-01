import { framer, useIsAllowedTo } from "@framer/plugin";
import { CopyToLLM } from "copy2llm-react";
// The reviewed widget IIFE, inlined into the plugin bundle at build time and
// written verbatim into the site's custom code — never fetched from a URL.
import widgetSource from "copy2llm-snippet/dist/copy2llm.global.js?raw";
import { useEffect, useState } from "react";
import "./app.css";
import {
  type Action,
  ALL_ACTIONS,
  buildSnippet,
  DEFAULT_CONFIG,
  type Font,
  isOurSnippet,
  mergeSnippet,
  type Position,
  type SnippetConfig,
  sendsContentExternally,
  stripSnippet,
  type Theme,
} from "./snippet";

type PendingKind = "install" | "remove";

// Confirm-step copy, kept as a pure module helper so App stays simple.
function confirmCopy(pending: PendingKind | null, installed: boolean) {
  if (pending === "remove") {
    return { title: "Remove from your site?", cta: "Remove" };
  }
  if (installed) {
    return { title: "Update your site?", cta: "Update" };
  }
  return { title: "Add to your site?", cta: "Add" };
}

// Custom code is injected at the end of <body> on every published page.
const LOCATION = "bodyEnd";

framer.showUI({ position: "top right", width: 290, height: 560 });

const POSITIONS: { value: Position; label: string }[] = [
  { value: "bottom-right", label: "Bottom Right" },
  { value: "bottom-left", label: "Bottom Left" },
  { value: "top-right", label: "Top Right" },
  { value: "top-left", label: "Top Left" },
];
const THEMES: { value: Theme; label: string }[] = [
  { value: "auto", label: "Auto" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];
const FONTS: { value: Font; label: string }[] = [
  { value: "sans", label: "Sans" },
  { value: "serif", label: "Serif" },
  { value: "mono", label: "Mono" },
];
const RADII = [
  { value: "sharp", label: "Sharp" },
  { value: "rounded", label: "Rounded" },
  { value: "pill", label: "Pill" },
];
const ACTION_LABELS: Record<Action, string> = {
  copy: "Copy as Markdown",
  view: "View as Markdown",
  chatgpt: "Open in ChatGPT",
  claude: "Open in Claude",
  perplexity: "Open in Perplexity",
  grok: "Open in Grok",
};

export function App() {
  // Writing the shared custom-code slot needs this permission.
  const isAllowed = useIsAllowedTo("setCustomCode");
  const [config, setConfig] = useState<SnippetConfig>(DEFAULT_CONFIG);
  const [customColors, setCustomColors] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [userDisabled, setUserDisabled] = useState(false);
  // The workflow reads the existing slot (to merge into it) before any write.
  // Don't enable the buttons until that read succeeds — otherwise we'd offer
  // Add/Update/Remove based on incomplete data and could clobber it on write.
  const [loaded, setLoaded] = useState(false);
  const [readError, setReadError] = useState(false);
  const [busy, setBusy] = useState(false);
  // Which write the user is confirming, if any — gates every setCustomCode call
  // behind a preview so a site-wide change is never one accidental click away.
  const [pending, setPending] = useState<"install" | "remove" | null>(null);

  // Reflect any existing install so the button reads Add vs Update, and warn
  // if the user has switched our code off in Site Settings (unrecoverable here).
  useEffect(() => {
    let active = true;
    framer
      .getCustomCode()
      .then((code) => {
        if (!active) {
          return;
        }
        const slot = code[LOCATION];
        setInstalled(isOurSnippet(slot?.html));
        setUserDisabled(Boolean(slot?.disabled));
        setLoaded(true);
      })
      .catch(() => {
        if (active) {
          setReadError(true);
          framer.notify("Couldn't read your site's custom code.", {
            variant: "error",
          });
        }
      });
    return () => {
      active = false;
    };
  }, []);

  const update = <K extends keyof SnippetConfig>(
    key: K,
    value: SnippetConfig[K]
  ) => setConfig((prev) => ({ ...prev, [key]: value }));

  const toggleAction = (action: Action) => {
    const has = config.items.includes(action);
    // Keep at least one action, and keep the canonical order stable.
    if (has && config.items.length === 1) {
      return;
    }
    const next = ALL_ACTIONS.filter((a) =>
      a === action ? !has : config.items.includes(a)
    );
    update("items", next);
  };

  // Custom endpoints: a controlled list of {label, href} rows.
  const endpoints = config.endpoints ?? [];
  const addEndpoint = () =>
    update("endpoints", [...endpoints, { label: "", href: "" }]);
  const updateEndpoint = (i: number, key: "label" | "href", value: string) =>
    update(
      "endpoints",
      endpoints.map((e, idx) => (idx === i ? { ...e, [key]: value } : e))
    );
  const removeEndpoint = (i: number) =>
    update(
      "endpoints",
      endpoints.filter((_, idx) => idx !== i)
    );

  const toggleCustomColors = (on: boolean) => {
    setCustomColors(on);
    if (on && !config.bg) {
      setConfig((prev) => ({ ...prev, bg: "#111111", text: "#ffffff" }));
    }
  };

  // The colors only apply when the toggle is on; preview/install share this.
  const effective: SnippetConfig = customColors
    ? config
    : { ...config, bg: undefined, text: undefined };
  // The exact markup the install would write.
  // Whether the current config lets a visitor send page content off-site — used
  // to spell out the data-sharing consequence in the confirm step.
  const sharesExternally = sendsContentExternally(effective);
  const snippet = buildSnippet(effective, widgetSource);
  // The confirm step shows the same config-bearing tag with the bundled widget
  // body elided — dumping 70 KB of minified JS into the preview helps no one.
  const snippetPreview = buildSnippet(
    effective,
    "/* … Copy to LLM widget, bundled with the plugin … */"
  );

  const doInstall = async () => {
    // Re-check write access at call time (not just via the disabled button).
    if (!framer.isAllowedTo("setCustomCode")) {
      framer.notify(
        "You don’t have permission to update this site’s custom code.",
        {
          variant: "error",
        }
      );
      setPending(null);
      return;
    }
    setBusy(true);
    try {
      // Read the current slot and splice our block in, so any unrelated custom
      // code in bodyEnd survives the write.
      const current = await framer.getCustomCode();
      const merged = mergeSnippet(current[LOCATION]?.html, snippet);
      await framer.setCustomCode({ html: merged, location: LOCATION });
      framer.notify(installed ? "Updated on your site" : "Added to your site", {
        variant: "success",
      });
      setInstalled(true);
    } catch {
      framer.notify("Couldn't update your site's custom code. Try again.", {
        variant: "error",
      });
    } finally {
      setBusy(false);
      setPending(null);
    }
  };

  const doRemove = async () => {
    if (!framer.isAllowedTo("setCustomCode")) {
      framer.notify(
        "You don’t have permission to update this site’s custom code.",
        {
          variant: "error",
        }
      );
      setPending(null);
      return;
    }
    setBusy(true);
    try {
      // Strip only our block; write back the rest (or clear the slot if ours
      // was all it held).
      const current = await framer.getCustomCode();
      const rest = stripSnippet(current[LOCATION]?.html);
      await framer.setCustomCode({
        html: rest === "" ? null : rest,
        location: LOCATION,
      });
      framer.notify("Removed from your site");
      setInstalled(false);
    } catch {
      framer.notify("Couldn't remove the code from your site. Try again.", {
        variant: "error",
      });
    } finally {
      setBusy(false);
      setPending(null);
    }
  };

  const { title: confirmTitle, cta: confirmCta } = confirmCopy(
    pending,
    installed
  );

  return (
    <main>
      <p className="intro">
        Add a Copy to LLM button to every published page of your site.
      </p>

      <div className="preview">
        <CopyToLLM {...effective} position="inline" />
      </div>

      <div className="field">
        <label htmlFor="position">Position</label>
        <select
          id="position"
          onChange={(e) => update("position", e.target.value as Position)}
          value={config.position}
        >
          {POSITIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label htmlFor="theme">Theme</label>
        <select
          id="theme"
          onChange={(e) => update("theme", e.target.value as Theme)}
          value={config.theme}
        >
          {THEMES.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label htmlFor="font">Font</label>
        <select
          id="font"
          onChange={(e) => update("font", e.target.value as Font)}
          value={config.font}
        >
          {FONTS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label htmlFor="radius">Corners</label>
        <select
          id="radius"
          onChange={(e) => update("radius", e.target.value)}
          value={config.radius}
        >
          {RADII.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label htmlFor="label">Label</label>
        <input
          id="label"
          onChange={(e) => update("label", e.target.value)}
          placeholder={DEFAULT_CONFIG.label}
          type="text"
          value={config.label}
        />
      </div>

      <hr />

      <div className="field">
        <label htmlFor="header">Include title + URL</label>
        <input
          checked={config.header}
          id="header"
          onChange={(e) => update("header", e.target.checked)}
          type="checkbox"
        />
      </div>

      <div className="field">
        <label htmlFor="custom-colors">Custom colors</label>
        <input
          checked={customColors}
          id="custom-colors"
          onChange={(e) => toggleCustomColors(e.target.checked)}
          type="checkbox"
        />
      </div>

      {customColors && (
        <>
          <div className="field">
            <label htmlFor="bg">Background</label>
            <input
              id="bg"
              onChange={(e) => update("bg", e.target.value)}
              type="color"
              value={config.bg ?? "#111111"}
            />
          </div>
          <div className="field">
            <label htmlFor="text">Text</label>
            <input
              id="text"
              onChange={(e) => update("text", e.target.value)}
              type="color"
              value={config.text ?? "#ffffff"}
            />
          </div>
        </>
      )}

      <hr />

      <span className="section-label">Menu actions</span>
      <div className="actions-grid">
        {ALL_ACTIONS.map((action) => (
          <label className="action" htmlFor={`act-${action}`} key={action}>
            <input
              checked={config.items.includes(action)}
              id={`act-${action}`}
              onChange={() => toggleAction(action)}
              type="checkbox"
            />
            {ACTION_LABELS[action]}
          </label>
        ))}
      </div>
      <p className="hint">
        <strong>Copy</strong> and <strong>View</strong> stay in the visitor’s
        browser — nothing is sent anywhere. The <strong>Open in…</strong>{" "}
        actions are off by default; turning one on lets a visitor open that AI
        service with this page’s Markdown in the URL. Enable them only if you’re
        fine sharing published page content with those services.
      </p>

      <hr />

      <span className="section-label">
        Custom endpoints <span className="opt">(optional)</span>
      </span>
      <p className="hint">
        Add your own LLM target — an internal or self-hosted chat. Put{" "}
        <code>{"{q}"}</code> where the page Markdown goes, or end the URL with{" "}
        <code>?q=</code>.
      </p>
      {endpoints.map((ep, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: controlled positional rows, no stable id
        <div className="endpoint" key={i}>
          <div className="endpoint-row">
            <input
              aria-label="Endpoint label"
              onChange={(e) => updateEndpoint(i, "label", e.target.value)}
              placeholder="Label (e.g. Acme AI)"
              type="text"
              value={ep.label}
            />
            <button
              aria-label="Remove endpoint"
              onClick={() => removeEndpoint(i)}
              type="button"
            >
              ✕
            </button>
          </div>
          <input
            aria-label="Endpoint URL"
            onChange={(e) => updateEndpoint(i, "href", e.target.value)}
            placeholder="https://acme.ai/?q={q}"
            type="text"
            value={ep.href}
          />
        </div>
      ))}
      <button className="add-endpoint" onClick={addEndpoint} type="button">
        + Add endpoint
      </button>

      {userDisabled && (
        <p className="warn">
          Your site’s code is switched off in Site Settings → Custom Code.
          Re-enable it there to go live.
        </p>
      )}

      {!isAllowed && (
        <p className="warn">
          This plugin needs permission to update your site’s custom code. Ask
          the project owner for edit access, then reopen the plugin.
        </p>
      )}
      {isAllowed && readError && (
        <p className="warn">
          Couldn’t read your site’s custom code, so changes are paused — reopen
          the plugin to try again.
        </p>
      )}

      {pending ? (
        <div className="confirm">
          <span className="section-label">{confirmTitle}</span>
          <p className="confirm-dest">
            Destination: end of <code>&lt;body&gt;</code>, on every published
            page.
          </p>
          {pending === "remove" ? (
            <p className="confirm-note">
              This removes the Copy to LLM block from every published page. Any
              other custom code in this location is left untouched.
            </p>
          ) : (
            <>
              <pre className="snippet">{snippetPreview}</pre>
              <p className="confirm-note">
                This adds the Copy to LLM button to{" "}
                <strong>every published page</strong>. Only the Copy to LLM
                block changes — any other custom code here is preserved.
              </p>
              {sharesExternally && (
                <p className="warn">
                  You’ve enabled actions that let a visitor send this page’s
                  Markdown to an external service (e.g. ChatGPT). That transfer
                  happens when the visitor clicks, on every published page. Turn
                  off the “Open in…” actions and custom endpoints to keep
                  everything on-page.
                </p>
              )}
            </>
          )}
          <div className="confirm-actions">
            <button
              className="framer-button-primary"
              disabled={busy}
              onClick={pending === "remove" ? doRemove : doInstall}
              type="button"
            >
              {confirmCta}
            </button>
            <button
              disabled={busy}
              onClick={() => setPending(null)}
              type="button"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="install">
          <button
            className="framer-button-primary"
            disabled={!(isAllowed && loaded)}
            onClick={() => setPending("install")}
            type="button"
          >
            {installed ? "Update on site" : "Add to site"}
          </button>
          {installed && (
            <button
              disabled={!(isAllowed && loaded)}
              onClick={() => setPending("remove")}
              type="button"
            >
              Remove from site
            </button>
          )}
        </div>
      )}
    </main>
  );
}
