import fs from "node:fs";
import path from "node:path";
import { extractFrontMatter, renderMarkdown } from "./markdown";

// Mirrored from the repo-root docs/partners/ (source of truth) into this package so
// Next.js can read it at build time regardless of Vercel's configured root directory
// (packages/web). Same manual-mirror pattern already used for the normative schemas
// (public/schemas/v1.1.1/*.json <- spec repo) — a CI sync step is queued for both.
const PARTNERS_DIR = path.join(process.cwd(), "content", "partners");

/** Visual grouping for the index page. Purely a display categorization — not part of
 * the spec or the docs themselves — so it lives here rather than in front matter. */
const CATEGORIES: Record<string, string> = {
  "retell-ai-integration": "Voice AI",
  "vapi-integration": "Voice AI",
  "bland-ai-integration": "Voice AI",
  "elevenlabs-integration": "Voice AI",
  "langchain-integration": "Orchestration",
  "mcp-server-integration": "Orchestration",
  "grok-bot-integration": "Chat & Social",
  "openclaw-integration": "Chat & Social",
};

export type PartnerDoc = { slug: string; title: string; description: string; category: string; html: string };

export function getPartnerSlugs(): string[] {
  if (!fs.existsSync(PARTNERS_DIR)) return [];
  return fs
    .readdirSync(PARTNERS_DIR)
    .filter((f) => f.endsWith(".md"))
    .map((f) => f.replace(/\.md$/, ""))
    .sort();
}

export function getPartnerDoc(slug: string): PartnerDoc | null {
  const file = path.join(PARTNERS_DIR, `${slug}.md`);
  if (!fs.existsSync(file)) return null;
  const raw = fs.readFileSync(file, "utf-8");
  const { title, description } = extractFrontMatter(raw);
  return { slug, title, description, category: CATEGORIES[slug] ?? "Integration", html: renderMarkdown(raw) };
}

export function getAllPartnerDocs(): PartnerDoc[] {
  return getPartnerSlugs()
    .map((slug) => getPartnerDoc(slug))
    .filter((d): d is PartnerDoc => d !== null);
}
