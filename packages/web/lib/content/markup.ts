/**
 * The content library's inline markup, in one place: `code`, [label](/path) and
 * [label](https://…). Nothing else is interpreted. Shared by the renderer
 * (components/content/Inline.tsx), the JSON-LD builders and the guards, so all three
 * read the same grammar.
 */
export const INLINE_TOKEN = /`([^`]+)`|\[([^\]]+)\]\(([^)\s]+)\)/g;

/** Plain text with the markup removed — for JSON-LD, meta tags and word counts. */
export function plain(text: string): string {
  return text.replace(INLINE_TOKEN, (_all, code?: string, label?: string) => code ?? label ?? "");
}

/** Every link target in a string, in order. */
export function linksIn(text: string): string[] {
  return [...text.matchAll(INLINE_TOKEN)].filter((m) => m[3] !== undefined).map((m) => m[3]!);
}
