/**
 * Shared content model for the long-form, server-rendered search surfaces:
 * /glossary, /learn, /compare, /use-cases, /blog and /state-of-agent-identity.
 *
 * One model, one renderer (components/content/ContentArticle.tsx), one guard file
 * (test/content.test.ts). Every page built from these types inherits the same honesty
 * checks the scenario library carries: no overclaim vocabulary, no level above L1
 * named without the issuance ceiling, no link into a repository that is not public, no internal
 * link that does not resolve, and — for anything that describes a third party — a
 * source for every claim.
 *
 * Inline markup inside `body`, `bullets`, `lead`, FAQ answers and definitions is
 * deliberately tiny: `[label](/internal/path)` or `[label](https://…)` for links and
 * `` `code` `` for code. Nothing else is interpreted, so copy cannot smuggle HTML.
 */

export interface ContentSection {
  readonly heading: string;
  readonly body: readonly string[];
  /** Optional bullet list rendered after the body paragraphs. */
  readonly bullets?: readonly string[];
  /** Optional comparison or reference table rendered after the bullets. */
  readonly table?: {
    readonly caption?: string;
    readonly columns: readonly string[];
    readonly rows: readonly (readonly string[])[];
  };
}

export interface ContentFaq {
  readonly q: string;
  readonly a: string;
}

/** A third-party source. Required on every comparison page and on the report. */
export interface ContentSource {
  readonly label: string;
  readonly url: string;
}

export interface ContentPage {
  /** URL segment. Permanent once shipped. */
  readonly slug: string;
  /** <title> text before the " · AgenID" suffix. 25–60 characters. */
  readonly title: string;
  /** Meta description, plain text, 120–165 characters. */
  readonly description: string;
  /** The page's single H1. */
  readonly h1: string;
  readonly keywords: readonly string[];
  /** Opening paragraphs, rendered directly under the H1. */
  readonly lead: readonly string[];
  readonly sections: readonly ContentSection[];
  readonly faqs: readonly ContentFaq[];
  /** Internal paths (e.g. "/glossary/ed25519", "/how-it-works/buying-tires"). Validated by test. */
  readonly related: readonly string[];
  readonly sources?: readonly ContentSource[];
  /** ISO date (YYYY-MM-DD) the content was written or last materially revised. */
  readonly updated: string;
}

export type GlossaryCategory =
  | "Identity"
  | "Cryptography"
  | "Verification"
  | "Keys and discovery"
  | "Agents and ecosystems"
  | "Policy and regulation";

export interface GlossaryTerm extends ContentPage {
  /** The term as it should appear in the index and in the DefinedTerm name. */
  readonly term: string;
  readonly category: GlossaryCategory;
  /** One or two sentences. Rendered as the definition box and used as DefinedTerm.description. */
  readonly definition: string;
  readonly alsoKnownAs?: readonly string[];
}

export interface BlogPost extends ContentPage {
  /** ISO date the capability shipped. */
  readonly published: string;
  /** Commit hashes on AgenID-protocol/agenid the post describes. Plain text (the repo is public; hashes are looked up there). */
  readonly commits: readonly string[];
  readonly tags: readonly string[];
}

export interface ComparisonPage extends ContentPage {
  /** The other approach's name, as its owner writes it. Text only — never a logo. */
  readonly subject: string;
  /** Who publishes it. */
  readonly owner: string;
  /** One sentence, cited in `sources`, describing what the subject is in its owner's own terms. */
  readonly subjectSummary: string;
  /** The side-by-side table. First column is the dimension. */
  readonly matrix: {
    readonly columns: readonly [string, string, string];
    readonly rows: readonly (readonly [string, string, string])[];
  };
  /** Where they fit together rather than compete. Every comparison has one. */
  readonly complementary: string;
  /** Required. A comparison with no sources is an opinion. */
  readonly sources: readonly ContentSource[];
}
