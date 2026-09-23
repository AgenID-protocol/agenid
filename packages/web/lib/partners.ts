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

/**
 * Search/social descriptions, written for the snippet rather than derived from the body.
 *
 * These used to be the first body paragraph cut at 300 characters, so every brief showed
 * a sentence chopped mid-word in search results, and two (Grok Bot, OpenClaw) showed raw
 * markdown link syntax. They live here rather than as front matter because the markdown
 * files are byte-identical mirrors of the repo-root docs/partners/ sources. Every entry
 * says "pattern, not a package": the briefs' own disclaimer has to survive into the
 * snippet, which is the only part of the page most people read. Guarded by
 * test/seo-metadata.test.ts (length, plain text, disclaimer present, one per slug).
 */
export const PARTNER_DESCRIPTIONS: Record<string, string> = {
  "retell-ai-integration":
    "How to attach a verifiable agenid:<ULID> to a Retell AI voice agent and check it independently. An integration pattern, not a shipped package.",
  "vapi-integration":
    "How to attach a verifiable agenid:<ULID> to a Vapi assistant using Vapi's documented APIs, then check it independently. A pattern, not a package.",
  "bland-ai-integration":
    "How to attach a verifiable agenid:<ULID> to a Bland AI calling agent so recipients can check who runs it. An integration pattern, not a package.",
  "elevenlabs-integration":
    "How to attach a verifiable agenid:<ULID> to an ElevenLabs Conversational AI agent and check it independently. A pattern, not a shipped package.",
  "langchain-integration":
    "How to attach a verifiable agenid:<ULID> to a LangChain or LangGraph agent so callers and auditors can check it. A pattern, not a shipped package.",
  "mcp-server-integration":
    "How to attach a verifiable agenid:<ULID> to an MCP server so clients can check who operates it. An integration pattern, not a shipped package.",
  "grok-bot-integration":
    "What attaching a verifiable agenid:<ULID> to an xAI Grok Bot takes, and where xAI's documented surface stops. A pattern, not a shipped package.",
  "openclaw-integration":
    "How to attach a verifiable agenid:<ULID> to an OpenClaw gateway so connected channels can check who runs it. A pattern, not a shipped package.",
};

/**
 * Which briefs a scenario page links to. Scenario pages are the site's search landing
 * pages and the briefs had only two inbound links each; this puts the relevant pattern
 * one click from the story that motivates it. Display wiring only — not scenario data,
 * so it stays out of lib/scenarios and its guards.
 */
export const SCENARIO_BRIEFS: Record<string, readonly string[]> = {
  "why-identity": ["mcp-server-integration", "retell-ai-integration"],
  "dentist-appointment": ["retell-ai-integration", "vapi-integration", "bland-ai-integration", "elevenlabs-integration"],
  "buying-tires": ["langchain-integration", "mcp-server-integration"],
  travel: ["langchain-integration", "openclaw-integration"],
  logistics: ["bland-ai-integration", "retell-ai-integration"],
  "b2b-procurement": ["langchain-integration", "mcp-server-integration"],
  "financial-transaction": ["mcp-server-integration", "langchain-integration"],
  "agent-delegation": ["langchain-integration", "mcp-server-integration", "openclaw-integration"],
  "today-vs-agentic": ["grok-bot-integration", "openclaw-integration"],
  "insurance-claim": ["mcp-server-integration", "langchain-integration"],
  "real-estate": ["langchain-integration", "mcp-server-integration"],
  "legal-services": ["mcp-server-integration", "langchain-integration"],
  recruiting: ["langchain-integration", "openclaw-integration"],
  "government-services": ["mcp-server-integration", "langchain-integration"],
  "home-services": ["vapi-integration", "retell-ai-integration"],
  "sales-outreach": ["retell-ai-integration", "vapi-integration", "bland-ai-integration", "elevenlabs-integration"],
  "personal-admin": ["elevenlabs-integration", "grok-bot-integration"],
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
  const { title, description: derived } = extractFrontMatter(raw);
  const description = PARTNER_DESCRIPTIONS[slug] ?? derived;
  return { slug, title, description, category: CATEGORIES[slug] ?? "Integration", html: renderMarkdown(raw) };
}

export function getAllPartnerDocs(): PartnerDoc[] {
  return getPartnerSlugs()
    .map((slug) => getPartnerDoc(slug))
    .filter((d): d is PartnerDoc => d !== null);
}
