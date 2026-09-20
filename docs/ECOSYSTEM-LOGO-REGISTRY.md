# Ecosystem Logo Registry

The single source of truth for every third-party company AgenID names in public.

A logo cloud is the highest-risk surface on a trust product's site. It is read in about
five seconds, it is made of other companies' names, and every name carries an
implication the reader supplies for free: that it is there because something is
connected. **Nothing on this site is.** This document is the contract that keeps that
true, and names the test that enforces each rule.

## Where it lives

| Thing | Path |
| --- | --- |
| Registry data — one reviewable JSON file per platform | `packages/web/data/ecosystem/*.json` |
| Types, status table, validator, render helpers | `packages/web/lib/ecosystem.ts` |
| Mark rendering (licensed SVG or typographic tile) | `packages/web/components/ecosystem/PlatformMark.tsx` |
| Homepage cloud | `packages/web/components/ecosystem/EcosystemHub.tsx` |
| Compatibility matrix | `packages/web/components/ecosystem/EcosystemMatrix.tsx` |
| Identity-persistence illustration | `packages/web/components/ecosystem/IdentityFlow.tsx` |
| Public page | `packages/web/app/ecosystem/page.tsx` → `/ecosystem` |
| Asset policy | `packages/web/public/assets/ecosystem/README.md` |

It is file-backed on purpose. This is a small, slow-moving, human-reviewed list where a
bad entry is a credibility problem rather than a data problem, so every change to a
claim goes through a diff and CI instead of a database write nobody sees.

## Categories

Six, declared in `ECOSYSTEM_CATEGORIES`. The clustering is the argument: model
providers, voice platforms and payment rails are different kinds of thing, and a flat
ring would say they are interchangeable neighbours of AgenID.

| Id | Label | What sits here |
| --- | --- | --- |
| `models` | Models | Model providers. Identity sits above the model, never inside it. |
| `voice` | Voice | Voice agent platforms where the identity rides the call. |
| `infrastructure` | Infrastructure | Where key documents, resolvers and runtimes are hosted. |
| `frameworks` | Frameworks | Orchestration layers that pass identity between agents and tools. |
| `enterprise` | Enterprise Identity | IAM systems AgenID composes with rather than replaces. |
| `action` | Action | Where a verified agent's decision becomes a real-world effect. |

## Statuses

Four, declared in `ECOSYSTEM_STATUSES`. Each carries the flag values an entry claiming
it must have, so the contract is read out of one table rather than restated as a boolean
expression that silently rots when a status is added.

| Status | Means | `verified` | `partner` | `evidence` |
| --- | --- | --- | --- | --- |
| `planned` | AgenID intends to support this and does not yet. No technical claim at all. | `false` | `false` | must be absent |
| `compatible` | Identity can be carried through this platform today using its existing, documented API surface. No AgenID-specific code is required from the platform, and none is claimed to exist. | `false` | `false` | must be absent |
| `verified-integration` | AgenID has executed the integration end to end and published the result. | `true` | `false` | **required** |
| `official-partner` | A partnership is on record with the platform. | `true` | `true` | **required** |

**As of this writing every one of the 27 entries is `compatible`.** Nothing is verified,
nothing is planned, and nothing is a partner.

`planned` is defined and deliberately unoccupied. A roadmap status is the easiest way to
pad an ecosystem graphic with aspiration, so it exists only so that a future
genuinely-committed integration has an honest place to sit before it works. A planned
entry may never be `featured` — the validator refuses it — because a reader does not
parse the badge, they count the marks.

## Relationship is derived, never stored

`relationshipOf()` computes one of three values from `status` and `docs`. A stored
relationship field would be a second source of truth for something the registry already
determines.

| Relationship | Means |
| --- | --- |
| `none` | Listed on technical grounds only. The platform has no involvement with AgenID. |
| `pattern-documented` | AgenID has published a written integration brief describing how identity travels through this platform. The brief is AgenID's own work; the platform has no involvement with it and ships no AgenID code. |
| `partner` | A partnership is on record. |

The distinction the whole graphic depends on: **"AgenID published a brief" is a fact
about AgenID's documentation, not a fact about the vendor.** A platform can have a brief
and know nothing about AgenID. Eight entries have briefs; none of them is a partner.

Status and relationship are printed as two separate facts in the detail panel. Collapsing
them is how "AgenID wrote a guide for Retell" becomes "Retell is a partner".

## Evidence requirements

Raising an entry above `compatible` asserts a fact about the world. `requiresEvidence`
is read out of the status table exactly like `verified` and `partner`, and the validator
refuses the entry rather than trusting the commit message.

- **`verified-integration`** needs the run: what was executed, when, and where the result
  is published. Not "it should work" — this project's history is a list of claims that
  were asserted without being computed.
- **`official-partner`** needs the agreement. A partnership is never inferred from logo
  usage, compatibility, API availability, a customer relationship, common ecosystem
  membership, or AIVH's own use of the platform.
- **`compatible`** needs no `evidence` field because its evidence *is*
  `compatibility_note`, which the validator already requires to be substantive. Carrying
  an evidence paragraph on a compatible entry is refused: it would read like proof of an
  integration the status says does not exist.

An AIVH-operated agent running on a platform is not evidence about that platform. The
AIVH-operated Grok Bot, the xAI platform, an official xAI integration and an xAI
partnership are four different things; only the first exists.

## Asset sourcing

The default mark is **typographic** — the platform's `abbr` set in the AgenID interface
type, monochrome, on a neutral tile. That is not a placeholder awaiting logos. It is the
platform-neutral treatment the design calls for, and it is what keeps the row reading as
one infrastructure layer rather than as a wall of brands.

Third-party logos are their owners' trademarks and are not redistributable just because
a platform is technically compatible with AgenID. **No third-party mark is redrawn,
scraped, generated, or shipped without permission.** Given that AgenID's whole
proposition is verifiable provenance, an unlicensed mark would be exactly the wrong
signal.

Order of preference when a mark is permitted:

1. A first-party asset already in the repo.
2. An officially supplied mark, under terms that permit this use.
3. Nothing — the typographic mark, which is always correct.

To add a licensed mark, follow `packages/web/public/assets/ecosystem/README.md`: strip
all colour to `fill="currentColor"`, remove `width`/`height`, keep a square-ish
`viewBox`, drop it at `public/assets/ecosystem/<category>/<id>.svg`, and add `logo_svg`
to the entry. The file is read at build time and inlined, not referenced as `<img src>`,
which is what makes `currentColor` work.

**No entry carries a `logo_svg` today.** Every mark on the site is typographic.

That is not an accident of effort. [`docs/brand-compliance-audit.md`](brand-compliance-audit.md)
reviewed sixteen providers' published trademark terms and found **zero** of them permit
an unaffiliated company to display their mark in a marketing ecosystem graphic — nine
expressly prohibit recolouring, which is exactly what this registry's monochrome
treatment requires. `packages/web/data/brand-permissions.json` is the machine-readable
record and `test/brand-permissions.test.ts` enforces it, so adding a `logo_svg` is now a
build failure unless that provider's terms say otherwise. Read that audit before
sourcing any mark.

## Aliases

`aliases` maps other brand names for the same platform onto the entry that governs it —
`Claude` onto `anthropic`, for example. They are never rendered; `name` is the one
display form. They exist so that a brand name written anywhere in the product resolves,
through `resolvePlatformName()`, to the entry whose status, relationship and evidence
rules apply to it. A name that resolves to nothing is a name outside every honesty
guard in this repository. Names and aliases are globally unique, so a brand can never
resolve two ways.

## How public rendering works

The UI consumes registry data and picks none of it.

- `buildCloudClusters()` produces the homepage cloud's props — finished strings,
  including every status and relationship label. A page mapping entries to props itself
  would be a second place a status label could be chosen.
- The cloud renders **featured entries only**, clustered in narrative order (models at
  twelve o'clock, action in the lower half) so the diagram reads technology → identity
  → action without a caption.
- `/ecosystem` renders the full matrix with category tabs, live search, the three status
  definitions above the grid with live counts, and an explicit no-endorsement notice.
- Emerald is reserved for an actual verified state across this whole product. An
  ecosystem listing is not one, so nothing in these components is emerald, and no status
  weaker than `verified-integration` carries the mint dot.
- There is no red anywhere. An unlisted or merely-compatible platform is not a negative
  finding.

## Adding an entry

1. Create `packages/web/data/ecosystem/<id>.json`. The `id` must match the filename and
   be unique; the `name` and every alias must be unique across the whole registry.
2. Start at `compatible` and write a `compatibility_note` that says what carrying an
   identity through this platform actually means, naming the documented API surface it
   rides on. Forty characters is the floor, not the target.
3. Pick the category by what the platform *does* in an identity's life, not by what the
   company is best known for.
4. `featured: true` puts it in the homepage cloud and therefore requires `capabilities`
   — up to six short factual phrases, each a restatement of something the note already
   establishes. A featured tile with an empty detail card invites the reader to supply
   their own idea of what "compatible" bought them.
5. Leave `logo_svg` out unless a licensed mark exists. Leave `evidence` out unless the
   status requires it.
6. Run `pnpm --filter @agenid/web test`. The validator and the four ecosystem test files
   are the review.

**Raising a status is a separate change from adding an entry, and needs its evidence in
the same commit.** If a platform integration actually ships, update that platform's
entry *and* the disclaimer in its `packages/web/content/partners/*.md` brief together —
a brief still saying "no adapter package exists" beside an entry claiming a verified
integration is the two-sources-of-truth failure this registry exists to prevent.

## How false claims are prevented

Every rule above is a test, because a rule that lives only in a document gets re-broken
by the next session.

| Rule | Enforced by |
| --- | --- |
| Registry loads; ids unique and matching filenames | `test/ecosystem.test.ts` |
| `verified`/`partner` agree with the status table | `test/ecosystem.test.ts` |
| Only the four documented statuses exist | `test/ecosystem.test.ts` |
| Every `docs` link points at a brief that exists | `test/ecosystem.test.ts` |
| Namespace stays on `agenid.com` | `test/ecosystem.test.ts` |
| Everything in the cloud is compatible-only | `test/ecosystem-cloud.test.ts` |
| A status cannot be reached by flipping one flag | `test/ecosystem-cloud.test.ts` |
| `planned` has no occupants | `test/ecosystem-cloud.test.ts` |
| A brief never becomes a partnership | `test/ecosystem-cloud.test.ts` |
| The cloud component asserts no trust vocabulary of its own | `test/ecosystem-cloud.test.ts` |
| Unique display names; declared categories only | `test/ecosystem-cloud.test.ts` |
| Featured entries have concrete capabilities | `test/ecosystem-cloud.test.ts` |
| No hex colour, no red, no emerald below verified | `test/ecosystem-cloud.test.ts` |
| Accessible names, keyboard operation, reduced motion | `test/ecosystem-cloud.test.ts` |
| Evidence required on, and only on, the statuses that claim something | `test/ecosystem-registry-integrity.test.ts` |
| A `planned` entry can never be featured | `test/ecosystem-registry-integrity.test.ts` |
| Every declared `logo_svg` resolves to a real file | `test/ecosystem-registry-integrity.test.ts` |
| Shipped marks are monochrome, sizeable, and not duplicated | `test/ecosystem-registry-integrity.test.ts` |
| Every vendor named on a public surface resolves to an entry | `test/ecosystem-registry-integrity.test.ts` |
| No brand name resolves two ways | `test/ecosystem-registry-integrity.test.ts` |
| The public surfaces assert no relationship | `test/ecosystem-registry-integrity.test.ts` |
| No mark ships without that provider's terms permitting it | `test/brand-permissions.test.ts` |

The vendor-resolution guard is the one worth understanding. Its vocabulary of company
names is deliberately kept *outside* the registry: a guard built only from the registry
can never notice a vendor that was added to a page and not to the registry, which is the
drift that matters. Adding a company to that list is free; adding one to a page without
adding it to the list or the registry is the thing that must not be quiet.

## Candidates considered and not added

| Candidate | Decision | Reason |
| --- | --- | --- |
| Coinbase | Not added | Reviewed for the `action` tier alongside Stripe and Twilio. No documented mechanism for carrying an `agenid:<ULID>` through it has been established here, so there is no `compatibility_note` that could be written truthfully today. A platform with neither a written brief nor a documented mechanism does not belong in the registry, and `planned` is not a place to park it — that status is for an integration AgenID has actually committed to. Revisit when the mechanism is established and written down. |
