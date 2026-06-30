// Minimal shim for the Framer runtime — only the bits this component uses.
// Framer provides the real module at runtime; we avoid the heavy dependency.
declare module "framer" {
  export const ControlType: {
    String: "string";
    Boolean: "boolean";
    Enum: "enum";
    Color: "color";
    Array: "array";
    Object: "object";
  };
  export function addPropertyControls(
    component: unknown,
    controls: Record<string, unknown>
  ): void;
}
