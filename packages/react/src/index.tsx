import { mount, type WidgetOptions } from "@copy2llm/widget";
import { useEffect, useRef } from "react";

export type CopyToLLMProps = WidgetOptions;

/**
 * The Copy to LLM button for React. Mounts the Shadow-DOM widget on mount and
 * tears it down on unmount. For `position="inline"` it mounts into an in-flow
 * anchor span; otherwise it mounts onto `document.body` and renders nothing.
 */
export function CopyToLLM(props: CopyToLLMProps): JSX.Element | null {
  const ref = useRef<HTMLSpanElement | null>(null);
  // Re-mount whenever an option changes; serializing keeps the dep stable.
  const serialized = JSON.stringify(props);

  useEffect(() => {
    const options = JSON.parse(serialized) as WidgetOptions;
    const target =
      options.position === "inline" ? (ref.current ?? undefined) : undefined;
    const handle = mount(options, target);
    return () => handle.destroy();
  }, [serialized]);

  return props.position === "inline" ? <span ref={ref} /> : null;
}
