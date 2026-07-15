import { mount, type WidgetOptions } from "copy2llm-widget";
import { type ReactElement, useEffect, useMemo, useRef } from "react";

export type CopyToLLMProps = WidgetOptions;

/**
 * The Copy to LLM button for React. Mounts the Shadow-DOM widget on mount and
 * tears it down on unmount. For `position="inline"` it mounts into an in-flow
 * anchor span; otherwise it mounts onto `document.body` and renders nothing.
 */
export function CopyToLLM(props: CopyToLLMProps): ReactElement | null {
  const ref = useRef<HTMLSpanElement | null>(null);

  const {
    position,
    theme,
    font,
    radius,
    label,
    prompt,
    header,
    content,
    exclude,
    bg,
    text,
    onEvent,
  } = props;
  const { items, endpoints } = props;
  // items/endpoints are fresh array references on every render; key the memo on
  // their content so the options object is stable until a value truly changes.
  const itemsKey = items?.join(",");
  const endpointsKey = endpoints?.map((e) => `${e.label} ${e.href}`).join("|");

  // A stable options object — re-created only when an actual option changes, so
  // the widget re-mounts on real edits, not on unrelated re-renders.
  // biome-ignore lint/correctness/useExhaustiveDependencies: items/endpoints are intentionally keyed by content (itemsKey/endpointsKey) rather than identity
  const options = useMemo<WidgetOptions>(
    () => ({
      position,
      theme,
      font,
      radius,
      label,
      prompt,
      header,
      content,
      exclude,
      bg,
      text,
      onEvent,
      items,
      endpoints,
    }),
    [
      position,
      theme,
      font,
      radius,
      label,
      prompt,
      header,
      content,
      exclude,
      bg,
      text,
      onEvent,
      itemsKey,
      endpointsKey,
    ]
  );

  useEffect(() => {
    const target =
      options.position === "inline" ? (ref.current ?? undefined) : undefined;
    const handle = mount(options, target);
    return () => handle.destroy();
  }, [options]);

  return position === "inline" ? <span ref={ref} /> : null;
}
