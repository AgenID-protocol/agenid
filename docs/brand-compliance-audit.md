# Third-party mark compliance audit

**Reviewed:** September 20, 2026
**Scope:** the sixteen providers proposed for an ecosystem logo wall on `agenid.com`.
**Machine-readable record:** [`packages/web/data/brand-permissions.json`](../packages/web/data/brand-permissions.json)
**Enforced by:** `packages/web/test/brand-permissions.test.ts`

## Result

**Zero of sixteen providers publish terms permitting an unaffiliated company to display
their logo in a marketing ecosystem graphic.** Not a majority — all of them.

Nine expressly prohibit altering a mark's colour, which is exactly what the proposed
neutral-grey monochrome treatment requires. Microsoft names the treatment itself as an
error: *"Don't make the logo a single color."* Anthropic states the rule in one
sentence: *"No alterations of our trademarks (changes to color, font, proportion, or
otherwise) are permitted."*

Consequently **no third-party artwork was installed.** The registry's existing
typographic rendering was already the only compliant option; this audit converts that
from a prudential judgement into an evidenced one, and into a test.

## Method

Every quotation below was pulled from a page on the provider's own domain. No
third-party logo aggregator was used as a source for any finding, and a test forbids one
from being recorded as a source later. Four of the quotations — Anthropic, AWS §13,
Twilio's corporate-logo passage, and Twilio's attribution notice — were independently
re-fetched and confirmed verbatim before being committed, because they are the ones the
conclusion rests on.

Where a page could not be read, that is recorded as unresolved rather than resolved
favourably. Three such cases are listed at the end.

## 1. Asset inventory

No assets were installed, so the inventory is a record of what was found and why it was
not used.

| Provider | Official source | SVG | Installed | Silver treatment | Basis |
|---|---|:--:|:--:|:--:|---|
| OpenAI | `openai.com/brand/` | public | no | prohibited | approved colour formats are black and white only |
| Anthropic | `anthropic.com/legal/trademark-guidelines` | public | no | prohibited | colour changes named explicitly; prior approval required |
| Google Gemini | `about.google/brand-resource-center/brand-elements/` | gated | no | prohibited | "including changing the color"; compatibility use is permission-gated |
| xAI / Grok | `x.ai/legal/brand-guidelines` | unverified | no | prohibited | "without any alteration or adjustment" |
| ElevenLabs | `elevenlabs.io/brand` | public | no | permission | ToS bars use "in whole or in part" without written permission |
| Retell AI | `retellai.com/logos` | public | no | permission | ToS requires prior written consent; the logo page carries no terms |
| Vapi | `vapi.ai/brand` | public | no | prohibited | "Do not alter these files"; approved monochrome is ink/cream |
| Bland AI | `bland.ai/legal/terms` | none | no | no policy | no brand page exists; all rights reserved |
| Synthflow | `synthflow.ai/identity` | none | no | prohibited | "with no alterations"; "avoid… unapproved variations" |
| Cloudflare | `cloudflare.com/trademark/` | none | no | prohibited | logos require written permission; badge is customer-only |
| AWS | `aws.amazon.com/trademark-guidelines/` | gated | no | prohibited | fair use is "plain text only (no logos)" |
| Google Cloud | `cloud.google.com/icons` | gated | no | prohibited | icons page grants nothing; general rules bar marketing use |
| Microsoft Azure | `microsoft.com/en-us/legal/intellectualproperty/trademarks` | gated | no | prohibited | "can never be used without an express license" |
| Twilio | `twilio.com/en-us/legal/trademark` | none | no | prohibited | corporate logo requires express written permission |
| Stripe | `stripe.com/newsroom/information` | public | no | prohibited | marks limited to the portion of a site relating to Stripe's services |
| Coinbase | `coinbase.com/press` | public | no | prohibited | held for review, and excluded on technical grounds as well |

## 2. Assets installed

None. `packages/web/public/assets/ecosystem/` contains documentation only, and a test
asserts it contains no artwork of any kind — a committed file is redistribution whether
or not a page renders it.

## 3. Assets not obtained, and why

The reason is the same in every case and it is not a retrieval failure. Several of these
providers publish SVGs that download in one click — OpenAI, Anthropic, Stripe, Retell,
ElevenLabs, Vapi and Coinbase all do. **The ease of the download says nothing about the
permission.** Stripe's newsroom page states directly that all brand elements remain
subject to its Marks Usage Agreement; Retell's logo page carries no terms whatsoever
while its Terms of Service require prior written consent for any use of its marks.

Three could not be retrieved even if they had been permitted: Google's Gemini-specific
guidelines sit behind an approved-partner login, xAI's asset archive returns HTTP 403,
and Synthflow distributes through an off-domain Google Drive link rather than serving an
asset from its own domain.

## 4. Brand restrictions affecting monochrome treatment or public use

### The treatment itself is prohibited

- **Anthropic** — *"No alterations of our trademarks (changes to color, font, proportion, or otherwise) are permitted."* An official one-colour Claude asset does ship, but it is white; rendering it grey is still a colour change under this rule.
- **Microsoft** — lists *"Don't make the logo a single color"* as a common error. Its only approved treatments are a grey logotype on light and a white logotype on dark, with the symbol full-colour in both.
- **Google / Google Cloud** — *"Don't combine your logo with the Google G or modify the Google G in any way, including changing the color,"* alongside *"Always use the full-color Google G."*
- **OpenAI** — *"Ensure each logo is displayed at an appropriate size, uses its approved color format, and is not distorted or altered in any way."* The official pack ships black and white only, so grey is not an approved format.
- **AWS §9** — *"You will not alter the logo images in any manner, including but not limited to changing the proportion, color, or font."*
- **Stripe** — *"Do not use any other color for the wordmark."*
- **Cloudflare** — *"Please do not alter Cloudflare web badges in any way (e.g., stretched out, different colors, etc)."*
- **Vapi** — *"Do not alter these files."* Its approved monochrome pairing is ink on cream, not grey.
- **Synthflow** — *"Always use the logo as provided… with no alterations,"* and *"Always use official color values… avoid applying tints, gradients, or unapproved variations."*

### Public use requires permission regardless of treatment

- **Twilio** — *"Twilio restricts use of the Twilio corporate logo, and you may not use it without our express written permission."* And, pre-empting the usual rationalisation: *"Affiliation with Twilio or Twilio programs does not imply the right to use the Twilio logo."* Twilio is also the only provider of the sixteen that requires an attribution notice where its marks appear.
- **Microsoft** — *"our logos, app and product icons, illustrations, photographs, videos, and designs can never be used without an express license."* Microsoft Azure is named among the assets requiring authorization.
- **AWS** — fair use for unaffiliated parties is *"plain text only (no logos)"*; §3(d) requires prior written permission for anything outside the customer and partner licences.
- **Cloudflare** — *"Use of the Cloudflare logos (other than the use of Web Badges described below) requires our written permission."* The badge is conditioned on being a Cloudflare customer.
- **xAI** — *"We may grant others the right to use our Marks, but you are not permitted to."*
- **Anthropic** — *"You may only use our trademarks as specifically permitted by us and only in materials we approve beforehand."*
- **Stripe** — *"Use our Marks only on the portion of your website or application that directly relates to our services."*
- **ElevenLabs** — marks *"may not be copied, imitated or used, in whole or in part, without our prior written permission."*
- **Retell AI** — *"Without the prior written consent of Retell AI, you are not permitted to make use of any of its Marks."*
- **Google** — showing compatibility with Google products is listed among the uses that affirmatively require permission.

### Affiliation

**Vapi** and **Google** address compatibility-style implication directly and prohibit it.
Every other provider with published guidelines carries a general bar on implying
affiliation, sponsorship or endorsement. This matters beyond the logos: a grid of vendor
marks communicates association by construction, which is the element that most weakens a
nominative-use argument.

### Narrower grants that do not reach this use

AWS Architecture Icons and Azure architecture icons are each licensed for a specific
purpose — architecture diagrams, training material, documentation — and for AWS, to
customers and partners. A marketing ecosystem graphic is none of those, and neither icon
set includes the provider's corporate logo. Google Cloud's icons page carries no licence
grant at all; its PDF is marked proprietary and confidential.

## 5. Registry

No `logo_svg` was added to any of the 27 ecosystem entries. The compliance record is a
separate registry, keyed to the same ids:

```json
{
  "id": "stripe",
  "provider": "Stripe",
  "registry_id": "stripe",
  "official_source": "https://stripe.com/newsroom/information",
  "reviewed": "2026-09-20",
  "svg": "public",
  "logo_use": "requires-permission",
  "recolor": "prohibited",
  "controlling_quote": "Use our Marks only on the portion of your website or application that directly relates to our services (such as on a checkout page using our payment processing services).",
  "quote_source": "https://stripe.com/marks/legal"
}
```

`markPolicyFor()` derives `typographic-only` or `licensed` from two facts: an
affirmative published position, and a recorded `license` naming who granted it and what
treatment it permits. It is derived rather than stored for the same reason
`relationshipOf()` is — a stored policy field is a second source of truth, and it is the
field a future session flips by hand.

**Nothing currently reaches `licensed`, and a test pins that.** If a real grant is ever
negotiated, that assertion is what forces the change to be a conscious one.

## 6. UI

The ecosystem UI is unchanged. `PlatformMark` already renders the typographic `abbr`
tile when no licensed asset exists, and keeps its inlining path for a mark that is one
day genuinely licensed. No component needed to change, which is the expected outcome
when the compliant rendering was already the default.

## 7. A defect this audit found in AgenID's own documentation

`public/assets/ecosystem/README.md` gave a four-step procedure for adding a mark,
beginning: drop in the SVG, strip its `fill` and `stroke` attributes, set
`fill="currentColor"`. **That procedure is the prohibited modification**, and it was the
only instruction a future author had.

Worse, it composed badly with a guard added the same week:
`ecosystem-registry-integrity.test.ts` asserts that any installed mark *must* have
`fill="currentColor"`. That is correct asset hygiene for a licensed mark, but together
the two read as an invitation — follow the README, satisfy the test, ship a violation,
and CI stays green the whole way. This was verified rather than assumed: a placeholder
asset wired to a registry entry passed every hygiene assertion.

The README has been rewritten to require a recorded grant first, and the new guard sits
upstream of the hygiene one so that the hygiene rules only ever apply to an asset that
is permitted to exist.

## 8. What is permitted, and is already shipped

Several providers publish approved wording for precisely the claim AgenID makes, in text
rather than artwork. AWS lists the permitted relational phrases outright, among them
*"compatible with"* and *"works with"*. Cloudflare approves *"runs on," "for use with,"
"for,"* and *"compatible with"* in word-mark form. Microsoft approves *"The Contoso App
works with Microsoft Teams."*

The registry's `compatibility_note` and `capabilities` fields already carry exactly this
kind of language, and `/ecosystem` already states that nothing in it is verified and
nothing is a partner. The compliant ecosystem surface is the one already live.

## 9. Unresolved

Recorded as unresolved rather than resolved favourably:

1. **Google's Gemini-specific guidelines** are gated behind an approved-partner account. This audit rests on Google's general brand rules, which Gemini-specific terms are more likely to tighten than loosen — an expectation, not a finding.
2. **xAI's asset archive** returns HTTP 403, so its contents and any monochrome variant could not be confirmed. Separately, the page identifies the trademark owner as "SpaceXAI" rather than "xAI"; flagged, not relied upon.
3. **Synthflow's asset kit** is distributed via Google Drive and was not enumerated, so whether an approved one-colour lockup ships is unknown.

Two further notes for the record. **Bland AI publishes no brand or trademark guidance at
all** — every candidate path 404s and no such link appears in its navigation. Silence is
not permission; its Terms reserve all rights not expressly granted. And the brief's
starting URL for Gemini pointed at `support.gemini.com`, which belongs to the Gemini
cryptocurrency exchange, a different company; it was not used.

## 10. Scope

This is a report of what the published guidelines say, verified against the providers'
own domains on the date above. It is not legal advice and does not address nominative
fair use, which can in some jurisdictions permit what a brand's own guidelines forbid —
a question for counsel rather than for the guidelines text. Brand terms change; the
`reviewed` date on each record is what makes staleness visible.

---

*AgenID Protocol — agenid.com. All rights reserved by AIVH LLC.*
