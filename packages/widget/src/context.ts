import type { ContextKind } from "./options";

export const CONTEXT_STORAGE_KEY = "copy2llm:context:v1";
export const MAX_CONTEXT_ITEMS = 20;
export const MAX_CONTEXT_CHARACTERS = 500_000;

export interface ContextItem {
  addedAt: number;
  id: string;
  kind: ContextKind;
  markdown: string;
  title: string;
  url: string;
}

export type ContextMutationStatus = "added" | "updated" | "duplicate" | "full";

export interface ContextMutation {
  items: ContextItem[];
  status: ContextMutationStatus;
}

/** A deliberately rough, dependency-free estimate suitable for UI guidance. */
export function estimateTokens(characters: number): number {
  return Math.ceil(Math.max(0, characters) / 4);
}

export function contextCharacters(items: readonly ContextItem[]): number {
  return items.reduce((total, item) => total + item.markdown.length, 0);
}

export function createContextItem(
  input: Omit<ContextItem, "addedAt" | "id">,
  now = Date.now()
): ContextItem {
  return {
    ...input,
    addedAt: now,
    id: `${now.toString(36)}-${Math.random().toString(36).slice(2, 9)}`,
  };
}

/** Add a source, deduplicating exact matches and updating a whole-page source. */
export function addContextItem(
  items: readonly ContextItem[],
  item: ContextItem
): ContextMutation {
  const exact = items.some(
    (existing) =>
      existing.kind === item.kind &&
      existing.url === item.url &&
      existing.markdown === item.markdown
  );
  if (exact) {
    return { items: [...items], status: "duplicate" };
  }

  const replaceIndex =
    item.kind === "page"
      ? items.findIndex(
          (existing) => existing.kind === "page" && existing.url === item.url
        )
      : -1;
  const next = [...items];
  if (replaceIndex >= 0) {
    const previous = next[replaceIndex];
    next[replaceIndex] = { ...item, id: previous.id };
  } else {
    if (next.length >= MAX_CONTEXT_ITEMS) {
      return { items: [...items], status: "full" };
    }
    next.push(item);
  }

  if (contextCharacters(next) > MAX_CONTEXT_CHARACTERS) {
    return { items: [...items], status: "full" };
  }
  return { items: next, status: replaceIndex >= 0 ? "updated" : "added" };
}

export function moveContextItem(
  items: readonly ContextItem[],
  id: string,
  direction: -1 | 1
): ContextItem[] {
  const next = [...items];
  const from = next.findIndex((item) => item.id === id);
  const to = from + direction;
  if (from < 0 || to < 0 || to >= next.length) {
    return next;
  }
  [next[from], next[to]] = [next[to], next[from]];
  return next;
}

export function buildContextMarkdown(items: readonly ContextItem[]): string {
  const sections = items.map((item, index) => {
    const title = item.title.trim() || "Untitled source";
    const source = item.url ? `\n> Source: ${item.url}\n` : "\n";
    return `## ${index + 1}. ${title}${source}\n${item.markdown.trim()}`;
  });
  return ["# AI context", ...sections].join("\n\n").trim();
}

function isContextItem(value: unknown): value is ContextItem {
  if (!value || typeof value !== "object") {
    return false;
  }
  const item = value as Partial<ContextItem>;
  return (
    typeof item.addedAt === "number" &&
    typeof item.id === "string" &&
    (item.kind === "page" ||
      item.kind === "selection" ||
      item.kind === "section") &&
    typeof item.markdown === "string" &&
    typeof item.title === "string" &&
    typeof item.url === "string"
  );
}

export function loadContext(storage?: Storage | null): ContextItem[] {
  if (!storage) {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(
      storage.getItem(CONTEXT_STORAGE_KEY) ?? "[]"
    );
    if (!Array.isArray(parsed)) {
      return [];
    }
    const items = parsed.filter(isContextItem).slice(0, MAX_CONTEXT_ITEMS);
    return contextCharacters(items) <= MAX_CONTEXT_CHARACTERS ? items : [];
  } catch {
    return [];
  }
}

export function saveContext(
  storage: Storage | null | undefined,
  items: readonly ContextItem[]
): boolean {
  if (!storage) {
    return false;
  }
  try {
    storage.setItem(CONTEXT_STORAGE_KEY, JSON.stringify(items));
    return true;
  } catch {
    return false;
  }
}
