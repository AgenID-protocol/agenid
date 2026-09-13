import fs from "node:fs";
import path from "node:path";
import { extractFrontMatter, renderMarkdown } from "./markdown";

// Mirrored from the repo-root docs/OPERATOR_ONBOARDING.md (source of truth) — same
// manual-mirror pattern as lib/partners.ts and the schema mirror; a CI sync step
// covering all three is queued.
const FILE = path.join(process.cwd(), "content", "onboarding.md");

export function getOnboardingDoc(): { title: string; description: string; html: string } | null {
  if (!fs.existsSync(FILE)) return null;
  const raw = fs.readFileSync(FILE, "utf-8");
  const { title, description } = extractFrontMatter(raw);
  return { title, description, html: renderMarkdown(raw) };
}
