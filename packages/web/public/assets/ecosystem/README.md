# Ecosystem platform marks

**This directory is empty of artwork, and that is the correct state.**

Entries in `packages/web/data/ecosystem/*.json` may carry an optional `logo_svg`
pointing at a file here. **None do**, and none may until the conditions below
are met.

## Why

Third-party logos are the trademarks of their owners and are not
redistributable just because a platform is technically compatible with AgenID —
and this registry lists platforms on technical grounds, with no relationship
implied (see the status definitions in `packages/web/lib/ecosystem.ts`).

That was originally a prudential judgement. As of Sept 20, 2026 it is an
evidenced finding. All sixteen candidate providers were audited against their
own published brand and trademark guidelines, every quote pulled from the
company's own domain: **`docs/brand-compliance-audit.md`**.

Result: **zero of sixteen** publish terms permitting an unaffiliated company to
display their logo in a marketing ecosystem graphic. Nine expressly prohibit
recolouring a mark, which is what the monochrome treatment requires. Microsoft
names the exact treatment as an error — *"Don't make the logo a single
color."* Anthropic's rule is the most direct: *"No alterations of our
trademarks (changes to color, font, proportion, or otherwise) are permitted."*

Several of these companies publish freely downloadable SVGs. **A downloadable
asset is not a grant** — Stripe's own newsroom page says so in as many words,
and Retell's public logo page carries no terms at all while its Terms of
Service require prior written consent. Ease of download says nothing about
permission.

So the default rendering is typographic: the platform's own name set in the
AgenID interface type, with a short monochrome `abbr` tile. That is already the
platform-neutral treatment the design calls for — no brand competes for
attention, everything reads as one infrastructure layer.

## Adding a licensed mark

The previous version of this file gave a four-step procedure here, beginning
"drop the SVG in and strip its fills." That procedure produces a trademark
violation for every provider this registry currently names, and it was the only
instruction a future author had. It has been replaced.

A mark may be installed only when **both** of the following are true, and the
test suite enforces both:

1. **A written grant exists.** Record it in
   `packages/web/data/brand-permissions.json` as a `license` on that provider:
   who granted it, where the grant lives, when, and — critically — *what
   treatment it permits*. A grant to display a mark is not a grant to recolour
   it. Raise that record's `logo_use` to `permitted-with-conditions` in the
   same change.
2. **The grant actually covers the rendering.** AgenID inlines marks and
   applies a single-colour treatment via `currentColor`. If the grant does not
   permit a monochrome rendering, the mark may not be used this way — obtain a
   licensed monochrome asset from the provider instead of producing one.

`markPolicyFor()` in `lib/brand-permissions.ts` derives the outcome from those
two facts. It is deliberately not a stored field: a stored policy is the field
a future session flips by hand.

Only once `markPolicyFor()` returns `licensed` for that provider may you add
`"logo_svg": "/assets/ecosystem/<category>/<id>.svg"` to its entry. Until then
`test/brand-permissions.test.ts` fails the build, and it also fails if artwork
is merely committed to this directory without being wired to anything — a file
here is redistribution whether or not a page renders it.

Asset hygiene for a genuinely licensed mark (square-ish `viewBox`, no
`width`/`height`, `fill="currentColor"`) is enforced separately by
`test/ecosystem-registry-integrity.test.ts`. Those are the rules for an asset
that is *allowed* to be here; this file governs whether it is.

## What to do instead

Several providers publish approved wording for precisely the claim AgenID needs
to make, in text rather than artwork. AWS lists the permitted relational
phrases outright — among them "compatible with" and "works with" — and its fair
use section states the constraint plainly: *"Any such use should be in plain
text only (no logos)."* Cloudflare approves "runs on," "for use with," "for,"
and "compatible with" in word-mark form. Microsoft approves "The Contoso App
works with Microsoft Teams."

The registry's `compatibility_note` and `capabilities` fields already carry
exactly this kind of language. The compliant ecosystem graphic is the one that
is already shipped.
