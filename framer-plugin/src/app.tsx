import { framer, useIsAllowedTo } from "@framer/plugin";
import { CopyToLLM } from "copy2llm-react";
import { useEffect, useState } from "react";
import "./app.css";
import {
  type Action,
  ALL_ACTIONS,
  buildSnippet,
  DEFAULT_CONFIG,
  type Font,
  isOurSnippet,
  type Position,
  type SnippetConfig,
  type Theme,
} from "./snippet";

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
};

export function App() {
  const isAllowed = useIsAllowedTo("setCustomCode");
  const [config, setConfig] = useState<SnippetConfig>(DEFAULT_CONFIG);
  const [customColors, setCustomColors] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [userDisabled, setUserDisabled] = useState(false);
  const [busy, setBusy] = useState(false);

  // Reflect any existing install so the button reads Add vs Update, and warn
  // if the user has switched our code off in Site Settings (unrecoverable here).
  useEffect(() => {
    let active = true;
    framer.getCustomCode().then((code) => {
      if (!active) {
        return;
      }
      const slot = code[LOCATION];
      setInstalled(isOurSnippet(slot?.html));
      setUserDisabled(Boolean(slot?.disabled));
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

  const install = async () => {
    setBusy(true);
    try {
      await framer.setCustomCode({
        html: buildSnippet(effective),
        location: LOCATION,
      });
      setInstalled(true);
      framer.notify(installed ? "Updated on your site" : "Added to your site", {
        variant: "success",
      });
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await framer.setCustomCode({ html: null, location: LOCATION });
      setInstalled(false);
      framer.notify("Removed from your site");
    } finally {
      setBusy(false);
    }
  };

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

      {userDisabled && (
        <p className="warn">
          Your site’s code is switched off in Site Settings → Custom Code.
          Re-enable it there to go live.
        </p>
      )}

      <div className="install">
        <button
          className="framer-button-primary"
          disabled={!isAllowed || busy}
          onClick={install}
          type="button"
        >
          {installed ? "Update on site" : "Add to site"}
        </button>
        {installed && (
          <button disabled={!isAllowed || busy} onClick={remove} type="button">
            Remove from site
          </button>
        )}
      </div>
    </main>
  );
}
