import { type CopyToLLMProps, CopyToLLM as Widget } from "@copy2llm/react";
import { addPropertyControls, ControlType } from "framer";

/**
 * Copy to LLM as a Framer code component. Thin wrapper over `@copy2llm/react`;
 * the property panel (below) maps to the same knobs as the snippet and npm package.
 */
export function CopyToLLM(props: CopyToLLMProps): JSX.Element {
  return <Widget {...props} />;
}

addPropertyControls(CopyToLLM, {
  position: {
    type: ControlType.Enum,
    title: "Position",
    options: ["bottom-right", "bottom-left", "top-right", "top-left", "inline"],
    optionTitles: [
      "Bottom Right",
      "Bottom Left",
      "Top Right",
      "Top Left",
      "Inline",
    ],
    defaultValue: "bottom-right",
  },
  theme: {
    type: ControlType.Enum,
    title: "Theme",
    options: ["auto", "light", "dark"],
    optionTitles: ["Auto", "Light", "Dark"],
    defaultValue: "auto",
  },
  bg: { type: ControlType.Color, title: "Background" },
  text: { type: ControlType.Color, title: "Text" },
  font: {
    type: ControlType.Enum,
    title: "Font",
    options: ["sans", "serif", "mono"],
    optionTitles: ["Sans", "Serif", "Mono"],
    defaultValue: "sans",
  },
  radius: {
    type: ControlType.Enum,
    title: "Radius",
    options: ["sharp", "rounded", "pill"],
    optionTitles: ["Sharp", "Rounded", "Pill"],
    defaultValue: "rounded",
  },
  content: {
    type: ControlType.String,
    title: "Content",
    placeholder: "CSS selector",
  },
  header: { type: ControlType.Boolean, title: "Header", defaultValue: true },
  label: {
    type: ControlType.String,
    title: "Label",
    defaultValue: "Copy as Markdown",
  },
  // `items` is omitted from the panel (defaults to all four actions); add a
  // multi-toggle later if a Framer user asks for it.
});
