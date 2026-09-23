import type { BlogPost } from "./types";

/**
 * Engineering release notes, one post per shipped capability, newest first.
 *
 * Facts come only from CHANGELOG.md and PROJECT_STATE.md in the reference
 * implementation (and, for the scenario library, from the scenario modules the post
 * describes). Commit hashes are plain text: the implementation repository is private
 * and is never linked.
 */

const CEILING =
  "The reference deployment at agenid.com issues nothing above L1_REGISTERED today: L2 and higher require a VerificationAssertion signed by a root authority key, and that key has not been created yet. L5 is reserved and is not issuable at all.";

const IDENTITY_NOT_PERMISSION =
  "Which agent is acting is not the same question as what it is allowed to do. AgenID answers the first. Protocol v1.1.1 defines no signed authorization object, so permission stays with the operator and with the party on the other side.";

export const POSTS: readonly BlogPost[] = [
  // ---------------------------------------------------------------------------
  {
    slug: "one-dns-probe-and-a-complete-openapi",
    published: "2026-09-20",
    commits: ["3566e04", "fb6609a"],
    tags: ["dns", "openapi", "release notes"],
    title: "One DNS Probe and a Complete OpenAPI Document",
    description:
      "AgenID merged three drifting DNS probes into one, deleted a credential-holding write path, and now documents all 13 deployed routes in its OpenAPI file.",
    h1: "One DNS probe, three deleted routes and an OpenAPI document that covers every route",
    keywords: ["AgenID DNS verification", "_agenid TXT record", "AgenID OpenAPI", "domain control evidence", "key discovery probe"],
    lead: [
      "This release is mostly subtraction. The `_agenid` TXT check existed in three places and provider detection in two, and the copies had already drifted apart in ways that would have failed silently. There is now one probe, `packages/web/lib/dns-probe.ts`, three superseded routes are gone, and the OpenAPI document describes all 13 deployed routes instead of 4.",
      "It also fixes a key-document check that reported `verified` for any successful HTTP answer, including a web page. Nothing here changes what AgenID issues. Domain control is evidence, not a level, and the ceiling is unchanged: " +
        CEILING,
    ],
    sections: [
      {
        heading: "How three copies drifted",
        body: [
          "The duplication had already become a correctness defect, in three ways, none of which would have produced an error.",
        ],
        bullets: [
          "Two routes built the TXT record value from their own local prefix constant instead of calling `verificationRecord()`. A change to the record's shape would have left them checking DNS for a value AgenID no longer asks for, matching nothing, forever.",
          "`/api/verify-dns` carried the disclosure that domain control is evidence and not a level. Its byte-for-byte twin `/api/dns/verify` did not, so an honesty rule was enforced on one copy of the same endpoint.",
          "`/api/dns/detect` did spec-literal Domain Connect discovery with no GoDaddy fallback, so two endpoints disagreed about whether the same domain supported one-click setup.",
        ],
      },
      {
        heading: "What was deleted, and why one deletion matters more",
        body: [
          "`POST /api/dns/verify` was a copy of `POST /api/verify-dns`. `POST /api/dns/detect` duplicated provider detection that `POST /api/domain/status` does better. `POST /api/dns/auto-add` held a Cloudflare or GoDaddy API credential and wrote to the operator's zone.",
          "The last one was deleted rather than left unconfigured, and that is the substantive decision. A credential-holding write path sitting idle in the tree invites a future session to finish it. AgenID does not hold write access to customers' DNS zones; that credential is exactly what the product argues against. A test now forbids any source file in `packages/web` from reading a DNS provider's API credential or calling a provider write API, and the whole `/api/dns` namespace must stay empty.",
          "The new guard then found two more copies that a search had missed, in the UI layer. `DomainFlow` fell back to a hand-built record value before the first server response arrived, so an operator could have copied and published a stale record and waited forever. Every cell of that record table now comes from the same builder the server uses.",
        ],
      },
      {
        heading: "The key-document probe no longer says verified",
        body: [
          "`POST /api/domain/status` also reports whether the operator publishes a key document at its `.well-known` path. It used to report `verified` whenever the operator's server answered 2xx. Most single-page-app hosts answer every unknown path with `200 text/html` and the homepage, and the operator domain of AgenID's own pilot does exactly that, so its homepage was reported as a verified key document, live.",
          "`key_discovery.status` is now `absent`, `invalid`, `published` or `unreachable`. `published` requires a 2xx `application/json` body, read to at most 64 KiB, that parses as a strict `KeysDocument` naming the probed domain as `controller_domain`. `invalid` carries a reason. Verified is deliberately not a state: the probe knows a domain, not an agent, and never compares keys against the registry. That comparison is the verifier's job. A new suite of 24 tests reproduces the single-page-app response end to end and was shown to fail against the old implementation.",
          "Separately, `POST /api/verify-dns` stopped echoing caller input when the resolver fails. Its `502` body now returns fixed text plus the error code.",
        ],
      },
      {
        heading: "An OpenAPI document that describes every route",
        body: [
          "The OpenAPI document now covers 13 deployed routes, up from 4. The old rule was never to document a route that does not exist. The new half of the rule exists because omission is a claim too: a contract describing 4 of 13 routes told a security reviewer that two unauthenticated write paths, a credential-forwarding proxy and two outbound DNS amplifiers did not exist.",
          "`packages/web/test/dns-surface.test.ts` now fails on a route handler with no documented path and on a documented path with no handler. The documentation check additionally asserts that the three deleted routes return 404 in production, because a claim that passes whether a route was deleted or merely undocumented is a claim nobody is checking.",
        ],
      },
      {
        heading: "What this does not do, and how to try it",
        body: [
          "One behavioral difference remains, on purpose: a resolver failure is `502` on `/api/verify-dns`, which answered a direct question, and `pending` on `/api/domain/status`, which will ask again in six seconds. None of these endpoints returns a verification level. " +
            IDENTITY_NOT_PERMISSION,
          "Fetch `https://www.agenid.com/api/v1/openapi.json` to see every deployed path. To see the probe from the operator's side, open [domain verification](/verify/domain) and enter a domain you control.",
        ],
      },
    ],
    faqs: [
      {
        q: "Does publishing an _agenid TXT record raise my agent's level?",
        a: "No. It records evidence of domain control and nothing more. " + CEILING,
      },
      {
        q: "Why was the DNS auto-add route deleted instead of disabled?",
        a: "It held a DNS provider credential and wrote to the operator's zone. AgenID does not hold write access to customers' DNS zones, and an unconfigured write path invites someone to finish it later. One-click setup goes through Domain Connect, where the operator authorizes the record at its own provider.",
      },
      {
        q: "What does published mean for a key document?",
        a: "It means the operator's domain served a strict, parseable key document that names that domain as its controller. It does not mean the key matches the registry. A verifier compares the two copies itself.",
      },
    ],
    related: ["/verify/domain", "/glossary/domain-control-verification", "/glossary/two-path-key-discovery", "/blog/domain-control-with-domain-connect", "/blog/documentation-you-can-test"],
    updated: "2026-09-23",
  },

  // ---------------------------------------------------------------------------
  {
    slug: "scenario-library-how-it-works",
    published: "2026-09-18",
    commits: ["2b8b035", "2577838"],
    tags: ["scenarios", "content", "release notes"],
    title: "Inside the Scenario Library at /how-it-works",
    description:
      "How the /how-it-works scenarios are built as typed data, why every one plays with and without AgenID, and the tests that keep their disclosures in place.",
    h1: "How the scenario library is built, and what keeps it honest",
    keywords: ["AgenID scenarios", "how AI agent verification works", "agent identity examples", "verification flow illustration"],
    lead: [
      "The [scenario library](/how-it-works) shows one handshake in many settings: an agent makes a claim, the counterparty refuses to act on the claim alone, the claim becomes a proof, and specific, scoped claims get checked. Every scenario also plays without AgenID, because the comparison is the argument. It shipped on 2026-09-18, and server-rendered search landing copy for each page followed on 2026-09-21.",
      "This post explains why the scenarios are a typed data model rather than hand-written pages, and which tests stop a future edit from quietly dropping a disclosure. The short version is that a scenario is an illustration of the protocol, not the resolution of a real agent, and the code is built around that difference.",
    ],
    sections: [
      {
        heading: "Illustrations are not resolutions",
        body: [
          "A surface that presents a real agent's state must read its level from the authoritative response and route it through the canonical trust-presentation module. The Verification Card, both badges and [/issue](/issue) all do. A surface that illustrates the protocol may name a level it is explaining, but only while saying unmissably that it is an illustration and only while stating what the reference deployment can issue today.",
          "Several scenarios illustrate L2, L3 and L4, so that statement matters. " + CEILING,
        ],
      },
      {
        heading: "Disclosures are required members of the type",
        body: [
          "The two disclosures, the example-flow label and the issuance ceiling, are not optional fields a future author can forget. They are required, and `test/scenarios.test.ts` asserts that every scenario carries them and that each one reaches the rendered page. The project's commit history is the reason: disclosures that depended on review conventions have gone missing before.",
          "The same type constrains what a scenario can say at all:",
        ],
        bullets: [
          "The only identifier any scenario uses is the spec's example, `agenid:01J8Z3P2K8VW4RN7XTQ6MYD5HC`. No scenario invents one, and no key material appears in any form.",
          "Level names are verbatim from v1.1.1, and the illustrated-level type omits L5 entirely. L5 is reserved, so it cannot be named.",
          "Rows have four tones: verified, declared, pending and neutral. There is no failed tone. Absence of verification is not a negative finding, and DECLARED renders amber, never emerald.",
          "Any scenario that shows a nonce must say that challenge-response is a proposed interaction pattern. v1.1.1 defines the signed objects, not that exchange.",
        ],
      },
      {
        heading: "Every scenario ends by stating what it did not prove",
        body: [
          "Each scenario carries a separate block listing what AgenID deliberately does not decide, and a scoped `proves` statement: what was established and, more importantly, what was not. In the [dentist appointment](/how-it-works/dentist-appointment) scenario the practice still decides what the caller may book. In [agent delegation](/how-it-works/agent-delegation) each hop is attributable, but the scope of each delegation is set by the operators.",
          IDENTITY_NOT_PERMISSION,
        ],
      },
      {
        heading: "Search landing copy under the same guards",
        body: [
          "The 2026-09-21 change gave each scenario page server-rendered prose for readers and crawlers: a keyword-bearing title and H1, a meta description, explanatory sections, an FAQ that is also emitted as FAQPage JSON-LD, and links to related scenarios. The animation carries the argument; the prose makes the page readable without it.",
          "That copy lives in the same module directory as the scenario data on purpose, so every existing guard, including no L5, no invented identifier, no key material and no hard-coded color, applies to it as well. `test/scenario-seo.test.ts` adds guards for title and description length, coverage of every page, overclaim vocabulary, and the requirement that each page still states what cannot be issued.",
        ],
      },
      {
        heading: "How to use it",
        body: [
          "Start at [/how-it-works](/how-it-works) and pick a setting close to your own, such as [buying tires](/how-it-works/buying-tires) for a multi-seller comparison or [procurement](/how-it-works/b2b-procurement) for business purchasing. Toggle between the two endings. Then register a real agent at [/issue](/issue) and resolve it at [/verify](/verify) to see what the reference deployment returns today, which is DECLARED and L1_REGISTERED.",
        ],
      },
    ],
    faqs: [
      {
        q: "Are the agents in the scenarios real?",
        a: "No. Scenarios are illustrations of the protocol. They use the spec's example identifier only and carry a label saying they are an example verification flow.",
      },
      {
        q: "Can I get the L2 or L3 level a scenario shows?",
        a: "Not today. " + CEILING,
      },
      {
        q: "Why is there no red state in any scenario?",
        a: "Because an unfinished or absent check is not evidence against an agent. The type has no failed tone, and pending checks render amber.",
      },
    ],
    related: ["/how-it-works", "/how-it-works/dentist-appointment", "/how-it-works/agent-delegation", "/glossary/declared-verified-authorized", "/blog/trust-presentation-fails-closed"],
    updated: "2026-09-23",
  },

  // ---------------------------------------------------------------------------
  {
    slug: "rate-limiting-every-public-write",
    published: "2026-09-18",
    commits: ["d8d9f96"],
    tags: ["security", "rate limiting", "release notes"],
    title: "Rate Limiting Every Public Write Endpoint",
    description:
      "Every POST route on agenid.com is now rate limited by an in-process floor plus a durable Postgres counter, and a wiring test fails CI on any new unbounded route.",
    h1: "Rate limiting every public write endpoint on agenid.com",
    keywords: ["AgenID rate limiting", "API rate limit design", "fail-open rate limiter", "registration flooding"],
    lead: [
      "Before this change, 25 rapid unauthenticated POSTs to `https://www.agenid.com/api/v1/agents` were all processed, with no `429` and no backoff. That was threat T-12 in the threat model, registration flooding and relay abuse, and it was the last threat in the model that anyone with an HTTP client could exploit today.",
      "Every POST endpoint is now rate limited, a batch endpoint has a size cap, and a wiring test fails the build if a new public write route is added without the limiter. Every write was already signature-verified; what was missing was a bound on volume.",
    ],
    sections: [
      {
        heading: "Two layers, and why the order is the design",
        body: [
          "The first layer is an in-process fixed window that cannot fail. The second is a durable counter in Postgres, `rate_limit_hit`, which performs the increment and the decision in one statement so concurrent requests serialize on the row instead of racing.",
          "The ordering gives the only honest definition of fail-open for this system. If the database is unreachable, the limiter degrades to per-instance limiting, never to unbounded. A test asserts exactly that by making 100 attempts against a broken durable layer and observing that only the burst gets through.",
          "The limit is checked before the request body is read, and a caller refused by the in-process floor never reaches the database, so the limiter cannot itself become an amplifier.",
        ],
      },
      {
        heading: "Identifying the caller without trusting the caller",
        body: [
          "The client is identified from platform-set headers, `x-real-ip` and `x-vercel-forwarded-for`, not from `x-forwarded-for`, which the caller supplies. Keying on a caller-supplied header would let a caller mint a fresh bucket per request: a limiter that looks like one and bounds nothing. IPv6 addresses are collapsed to their /64, so one allocation is one bucket.",
          "`POST /api/retell/bind` also caps its `agents` array at 25 and returns `400 batch_too_large` above that. Without the cap, the rate limit would bound requests while one request could still trigger an unbounded number of store writes.",
        ],
      },
      {
        heading: "The wiring test found six more routes",
        body: [
          "The gap analysis named four surfaces, and the first pass bounded those four. A guard that walks every `route.ts` under `app/api` and requires each POST handler to call the limiter then failed on six more routes. All ten are now bounded. The standing rule applies: a fix scoped to the instance you found is a sample, not a fix.",
          "The guard also asserts that the limiter runs before the body is parsed, and it carries an explicit exemption list with a stated reason per entry. Removing the limiter from the registration route turns three tests red.",
        ],
      },
      {
        heading: "Counters are telemetry, not registry data",
        body: [
          "`rate_limit_counters` ships with row-level security enabled and no policies at all, unlike every other table in the schema. Per-caller request counts are operational telemetry, and publishing them would turn the limiter's own state into a reconnaissance surface.",
          "A follow-up fix corrected the grants on the two `SECURITY DEFINER` functions. Revoking `EXECUTE` from `anon` and `authenticated` removed nothing, because Postgres grants `EXECUTE` to `PUBLIC` on new functions. A corrective migration closes that, a test fails on any such function whose `EXECUTE` is never revoked from `PUBLIC`, and the sweep of old windows is now actually called, on roughly one durable hit in 200.",
        ],
      },
      {
        heading: "What this does not do",
        body: [
          "Rate limiting bounds volume. It does not authenticate anyone. Nothing yet binds a live HTTP request to a registered agent, and the residual risk from distributed sources is rated medium rather than closed. It also changes nothing about levels. " +
            CEILING,
          IDENTITY_NOT_PERMISSION,
          "To see it, register an agent at [/issue](/issue); the write path it calls is one of the ten bounded routes.",
        ],
      },
    ],
    faqs: [
      {
        q: "What happens if the rate-limit database is down?",
        a: "The durable layer is skipped and the in-process floor still applies, so limiting degrades to per-instance rather than disappearing.",
      },
      {
        q: "Why not use the X-Forwarded-For header?",
        a: "The caller controls it. Keying a limiter on it would let each request claim a new identity and a new bucket.",
      },
      {
        q: "Does rate limiting authenticate agents?",
        a: "No. It limits how often a source may write. Request-level authentication, binding a live request to a registered agent, is planned and not implemented.",
      },
    ],
    related: ["/trust", "/issue", "/blog/removing-fabricated-verification", "/blog/documentation-you-can-test"],
    updated: "2026-09-23",
  },

  // ---------------------------------------------------------------------------
  {
    slug: "registry-key-discovery-is-live",
    published: "2026-09-15",
    commits: ["7821338", "22033b0", "81b9c6e"],
    tags: ["key discovery", "security", "release notes"],
    title: "Registry Key Discovery Is Live at /v1/keys",
    description:
      "The registry's key-discovery route is deployed, completing the registry half of two-path key discovery, with the security decision made on the raw request target.",
    h1: "The registry half of two-path key discovery is live",
    keywords: ["two-path key discovery", "AgenID key discovery", "operator key lookup", "verify AI agent key"],
    lead: [
      "`GET /v1/keys/<key-ulid>` is deployed on www.agenid.com. It serves the registry's copy of an operator key, and it was the only undeployed half of the mechanism that makes the registry non-authoritative. A verifier can now fetch the operator key from the registry and from the operator's own domain, at `https://<operator_domain>/.well-known/agenid/keys.json`, and require that they agree.",
      "Making it answer identically on every platform took follow-up work, because the security decision was first built on a framework's decoded path parameter, and in production that parameter had been decoded one more time than the code assumed.",
    ],
    sections: [
      {
        heading: "What the endpoint does",
        body: [
          "The route is read-only, unauthenticated and has no side effects. It serves a key document already in the store, verifies nothing and reports no verification level. The spec-required query form, `GET /v1/keys?key_id=<percent-encoded logical id>`, returns a byte-identical document built by the same response builder.",
          "The path segment is the wire form of the identifier, a bare ULID, while the store is keyed on the logical form `agenid:key:<ULID>`. The only translation between them is `parseKeyReference` from `@agenid/core`. A key that was never published is `404 key_not_found`; a malformed reference or a URI fragment is `400 invalid_key_id`. Documents are re-validated against the strict `KeyDocument` schema before being served, and error bodies do not quote the caller's input back.",
        ],
      },
      {
        heading: "Why two paths matter",
        body: [
          "If the only place to fetch an operator's key were the registry, the registry could substitute a key it controls and mint apparently valid identities. Two-path discovery removes that position. The registry can still serve a key, but a verifier who also fetches the operator's copy will see any disagreement, and disagreement is a hard fail.",
          "The honest boundary: the `.well-known` copy is published by the operator. Where an operator publishes none, a verifier has one source, not two, and should not treat the missing copy as agreement.",
        ],
      },
      {
        heading: "The double-decode defect",
        body: [
          "Measured against production, a twice-encoded key ULID returned `200`, while the identical code returned `400` under a local `next start`. The earlier guard rejected a reference that still carried a `%` after the transport decode, which assumed exactly one decode had happened. On Vercel the platform normalizes the path before routing and Next decodes the dynamic segment again, so the guard was inspecting a value two decodes from the wire.",
          "The rule is now stated on the raw request target, where it needs no decode of its own: the path segment must be the literal wire form, and a bare key ULID contains no percent sign. The `?key_id=` value is decoded by the registry itself, exactly once. A repeated `key_id` parameter is refused, in either order, because an ambiguous request cannot promise the identical document the spec requires.",
        ],
      },
      {
        heading: "One surface, not two",
        body: [
          "The reference implementation has two registries, a Fastify one and the Next one that production serves, and they had diverged: only the Next version re-validated stored documents and kept caller input out of errors. Both now call one `resolveKeyDocument`. A parity test drives the real handlers of both frameworks from raw request-target fixtures and requires identical status, body and reason.",
          "Fastify framework errors no longer reflect the request target. `/v1/keys` is read-only on both frameworks, with every mutating method answering `405` with an `Allow` header, and authority key publication moved to `POST /v1/authority/keys`.",
        ],
      },
      {
        heading: "What it does not do, and how to try it",
        body: [
          "Key discovery serves keys. It says nothing about levels. " + CEILING + " " + IDENTITY_NOT_PERMISSION,
          "Register an agent at [/issue](/issue), open its JSON envelope from the Verification Card, and follow `operator_key.discovery` to both paths. The [two-path key discovery](/glossary/two-path-key-discovery) entry explains the comparison step by step.",
        ],
      },
    ],
    faqs: [
      {
        q: "Do I have to publish a .well-known key document?",
        a: "Registration works without one. Without it, a verifier has only the registry's copy, so the key-substitution defense is not in force for your agent.",
      },
      {
        q: "Does /v1/keys tell me whether an agent is verified?",
        a: "No. It serves a key document and reports no level. Verification is done by re-checking signatures against the envelope.",
      },
      {
        q: "What happens to a retired key?",
        a: "Retired and revoked keys stay resolvable so historical signatures remain checkable. There is no revocation flow deployed today.",
      },
    ],
    related: ["/glossary/two-path-key-discovery", "/glossary/well-known-uri", "/glossary/operator-key", "/learn/how-to-verify-an-ai-agent", "/verify"],
    updated: "2026-09-23",
  },

  // ---------------------------------------------------------------------------
  {
    slug: "domain-control-with-domain-connect",
    published: "2026-09-15",
    commits: ["1806e54"],
    tags: ["dns", "domain connect", "release notes"],
    title: "Domain Control Evidence with Domain Connect",
    description:
      "/verify/domain checks an _agenid TXT record and uses Domain Connect for one-click setup, so the operator authorizes the record and AgenID holds no DNS credentials.",
    h1: "Domain control evidence, and why AgenID holds no DNS write credentials",
    keywords: ["Domain Connect", "_agenid TXT record", "domain control verification", "AI agent domain verification"],
    lead: [
      "[/verify/domain](/verify/domain) lets an operator show that it controls the domain named in its agent's manifest. The operator publishes an `_agenid.<domain>` TXT record, and AgenID performs a real DNS lookup for it. For one-click setup the page uses Domain Connect, the open protocol in which the operator authorizes a record change at its own DNS provider.",
      "The architectural decision in this release matters more than the page. There were two ways to offer one-click DNS setup: hold a provider API credential and write into the customer's zone, or have the customer authorize the change where their DNS lives. AgenID chose the second, and later deleted the code for the first.",
    ],
    sections: [
      {
        heading: "What the page checks",
        body: [
          "`POST /api/verify-dns` performs a real `_agenid.<domain>` TXT lookup against a per-domain token, joining chunked TXT records, and on a match reports `proves: \"domain_control\"`. `/verify/domain` polls `POST /api/domain/status`, which returns provider detection, one-click availability, TXT record state and the state of the operator's `.well-known` key document from a single read, so the page cannot display a combination of states that never coexisted.",
          "The token is per domain. That is worth saying because an earlier generated route used one hard-coded token for every user and every domain; it was removed as a fabricated-verification stub on 2026-09-14.",
        ],
      },
      {
        heading: "Why AgenID holds no DNS write credentials",
        body: [
          "A service that proves identity should not hold standing write access to its users' DNS zones. That credential can redirect mail, obtain certificates for the domain and publish a different key document, which is the very evidence a verifier relies on. Holding it would make AgenID a single point from which operator identities could be rewritten.",
          "With Domain Connect the operator signs in to its own provider and approves one specific record. AgenID never sees a provider credential. A route that did hold a Cloudflare or GoDaddy credential existed in the tree, unconfigured. It was later deleted rather than left idle, and a test now forbids any web source file from reading a DNS provider credential or calling a provider write API.",
        ],
      },
      {
        heading: "Where one-click stands today",
        body: [
          "One-click Domain Connect is pending registration of AgenID's service template with DNS providers. Until then the one-click URL is null, and the interface renders no button rather than a link that would 404 on someone else's dashboard. Operators add the TXT record by hand, which the page walks through with the exact name and value.",
          "Provider detection uses spec-literal Domain Connect discovery with a GoDaddy fallback, and a resolver failure on the polling endpoint reports `pending` and retries rather than failing the flow.",
        ],
      },
      {
        heading: "Evidence is not a level",
        body: [
          "Confirming domain control records evidence. It raises nothing. " + CEILING,
          "When L2 does ship, it is planned as the first level above L1 precisely because its evidence is a DNS record any third party can re-derive, so a wrongly issued L2 would be externally detectable.",
        ],
      },
      {
        heading: "What it does not do, and how to try it",
        body: [
          IDENTITY_NOT_PERMISSION + " Domain control says an operator controls a name. It says nothing about what the operator's agent may do on anyone's behalf.",
          "Open [/verify/domain](/verify/domain), enter a domain you control, publish the record it shows and wait for the check to complete. The [domain control verification](/glossary/domain-control-verification) and [Domain Connect](/glossary/domain-connect) entries cover the background.",
        ],
      },
    ],
    faqs: [
      {
        q: "Does AgenID ever ask for my DNS provider password or API key?",
        a: "No. AgenID holds no DNS write credentials. One-click setup, once the template is registered, goes through your own provider, and today you add the TXT record yourself.",
      },
      {
        q: "Will confirming domain control make my agent L2_DOMAIN_VERIFIED?",
        a: "No. " + CEILING,
      },
      {
        q: "Why is there no one-click button yet?",
        a: "Domain Connect requires AgenID's service template to be registered with each provider. Until it is, the page shows manual steps instead of a link that would not work.",
      },
    ],
    related: ["/verify/domain", "/glossary/domain-connect", "/glossary/domain-control-verification", "/blog/one-dns-probe-and-a-complete-openapi", "/docs/onboarding"],
    updated: "2026-09-23",
  },

  // ---------------------------------------------------------------------------
  {
    slug: "trust-presentation-fails-closed",
    published: "2026-09-15",
    commits: ["1951d95", "c2b4d94"],
    tags: ["badges", "verification card", "security"],
    title: "Trust Presentation Now Fails Closed",
    description:
      "Badges and the Verification Card once rendered any unrecognized level as verified. One canonical module now maps levels and resolves everything else to neutral.",
    h1: "Trust presentation now fails closed",
    keywords: ["AgenID badge", "verification card", "fail closed", "trust state presentation"],
    lead: [
      "Both AgenID badges and the Verification Card mapped levels with the same shape of logic: if the level is L1_REGISTERED, render amber; otherwise render emerald VERIFIED. An unrecognized, absent, empty or malformed level therefore rendered as the strongest claim the product can make.",
      "Nothing forged a signature. The presentation layer upgraded on ignorance: the verified state was produced by the absence of information rather than by any evidence. This release moves every trust-state decision into one module that fails closed.",
    ],
    sections: [
      {
        heading: "What was wrong",
        body: [
          "A trust surface has one job that matters more than the others: never show more than the evidence supports. An `else` branch that defaults to verified inverts that. Any bug upstream, such as a renamed field, a new level string, a network error that left the level empty, or a typo in an embed, would have surfaced to a reader as a green verified badge.",
          "The defect lived in three places, the two badges and the card, each with its own copy of the mapping, which is how it survived review. Fixing one would have left two.",
        ],
      },
      {
        heading: "One canonical module",
        body: [
          "`packages/web/lib/trust-presentation.ts` now enumerates the level names the product knows how to present and resolves everything else to a neutral, non-verified state. Every surface that shows a real agent's state reads its level from the authoritative response and routes it through this module.",
          "`/badge.js` used to be a static file with its own table. It is now a route generated from the canonical module, so no consumer carries its own mapping and a future change lands everywhere at once.",
        ],
        bullets: [
          "DECLARED renders amber. It sits below L1, and the panel states that no third party has checked the claims.",
          "L1_REGISTERED renders amber. L1 is a self-declaration.",
          "Anything unrecognized renders neutral grey. Not verified is never red, because absence of verification is not a negative finding.",
          "`/badge/<agenid>/shield.svg` always returns 200 and reads NOT REGISTERED in grey for an unknown identifier, since a non-200 would render as a broken image.",
        ],
      },
      {
        heading: "Why emerald is reserved",
        body: [
          "The brand guide reserves Verified Emerald strictly for verified state: a specific claim that a third party checked against evidence. Nothing the reference deployment issues today meets that bar. " +
            CEILING,
          "So in practice no real agent's badge renders emerald today, and that is the correct result.",
        ],
      },
      {
        heading: "What a badge does not say",
        body: [
          "A badge reports an identity state. " + IDENTITY_NOT_PERMISSION,
          "A badge is also a convenience, not the check. A relying party that needs certainty should resolve the envelope and re-verify signatures itself, which the registry cannot forge.",
        ],
      },
      {
        heading: "How to try it",
        body: [
          "Embed the badge with `/badge.js` or reference `/badge/<agenid>/shield.svg` from a README, as described on the [badge page](/badge). Point it at an identifier that does not exist and you will get a neutral grey badge, not an error and not a verified state. The [Verification Card](/glossary/verification-card) entry explains what the card shows.",
        ],
      },
    ],
    faqs: [
      {
        q: "Why does my registered agent's badge show amber and not green?",
        a: "Because L1_REGISTERED is a self-declaration. Emerald is reserved for claims a third party checked, and no such level is issued today.",
      },
      {
        q: "Can a badge ever show verified by mistake now?",
        a: "The failure mode that did that is gone: unknown or missing levels resolve to neutral. A reader who needs certainty should still re-verify the envelope rather than rely on a badge.",
      },
      {
        q: "Why is not-verified grey rather than red?",
        a: "An agent without verification has not failed anything. Rendering it red would present missing evidence as negative evidence.",
      },
    ],
    related: ["/badge", "/glossary/verification-card", "/glossary/verification-level", "/blog/removing-fabricated-verification", "/trust"],
    updated: "2026-09-23",
  },

  // ---------------------------------------------------------------------------
  {
    slug: "documentation-you-can-test",
    published: "2026-09-15",
    commits: ["d9ed729"],
    tags: ["documentation", "ci", "release notes"],
    title: "Documentation You Can Test Against Production",
    description:
      "check:docs verifies AgenID's documentation in CI and, with --live, checks documented endpoint claims against the production deployment rather than the source.",
    h1: "Documentation you can test: checking the docs against production",
    keywords: ["documentation testing", "docs as tests", "AgenID API documentation", "check docs against production"],
    lead: [
      "`scripts/check-docs.mjs` is a documentation consistency check wired into CI. The static pass resolves every relative link, compares the README's package list against the workspace, forbids dead hosts and overclaim vocabulary, and asserts that L5 stays out of the issuable enum. With `--live`, it calls the production deployment and checks sixteen documented endpoint claims against what the endpoints actually return.",
      "The check exists because re-reading documentation does not find what is wrong with it. Verifying the API reference against the live deployment found six fabricated claims in it, and verifying a documentation claim against live responses rather than a grep of the source found a real CORS defect.",
    ],
    sections: [
      {
        heading: "What the live check asserts",
        body: [
          "The live pass asserts the error code wherever the documentation names one, not just the HTTP status. A bare status code cannot distinguish documented behavior from a route that does not exist: both might be a 404. It also checks the OpenAPI version and path coverage against production.",
          "Where two different rules could produce the same code for the same request, it asserts the reason as well. The multiply-encoded key targets that once resolved in production are checked this way, so the protection is tested and not only the status.",
        ],
      },
      {
        heading: "What verifying against production found",
        body: [
          "The previous API reference had six claims that were not true of the deployed system:",
        ],
        bullets: [
          "The registration response shape was wrong: the level is nested under `verification`, and `status`, `manifest_digest` and `links` were missing.",
          "A `422` status was documented that the API never returns.",
          "`POST /api/v1/verify` was described as ManifestProof verification when it is a raw Ed25519 signature check.",
          "The error-code table conflated three separate namespaces, and the `503` registry-unavailable path was undocumented.",
          "The resolver's deliberate split, a `200` HTML card and a `404` JSON response for an unknown identifier, was documented as a flat `404`.",
        ],
      },
      {
        heading: "Findings beyond the API reference",
        body: [
          "`/api/retell/bind` answered CORS preflight but sent no CORS header on its responses, so a cross-origin browser request cleared preflight and was then rejected. A test now requires preflight and response to agree.",
          "`SECURITY.md` named a private vulnerability reporting channel that the host only offers on public repositories. Reporting is now enabled on the public [spec](https://github.com/AgenID-protocol/spec) and [conformance](https://github.com/AgenID-protocol/conformance) repositories instead. The same review recorded that agenid.com publishes no MX records, so no security mailbox on that domain can receive mail; a reporting address that does not receive is worse than none.",
        ],
      },
      {
        heading: "Why this is a standard and not a cleanup",
        body: [
          "For a verification protocol, documentation is part of the trust surface. A reader who is told an endpoint exists, or that a level can be issued, will act on it. The same rule that forbids a badge from showing more than the evidence supports applies to prose. The check keeps the ceiling statement honest as well: " +
            CEILING,
          IDENTITY_NOT_PERMISSION,
        ],
      },
      {
        heading: "How to try it",
        body: [
          "Inside the repository the static check runs as `pnpm run check:docs` and the production check as `pnpm run check:docs:live`. The implementation repository is not public yet, but you can run the same kind of check yourself: fetch `https://www.agenid.com/api/v1/openapi.json`, call a documented route with a bad input, and compare the error code with what the document describes. The [onboarding guide](/docs/onboarding) lists the public routes. The public [conformance suite](https://github.com/AgenID-protocol/conformance) tests the protocol side independently.",
        ],
      },
    ],
    faqs: [
      {
        q: "Does check:docs run on every change?",
        a: "The static check is wired into CI. The live check calls production and is run to confirm documented claims against the deployed system.",
      },
      {
        q: "Why assert error codes instead of status codes?",
        a: "Because different causes share a status. A 404 from a missing route and a 404 from an unknown agent look the same unless the code is checked.",
      },
      {
        q: "Is the conformance suite the same as check:docs?",
        a: "No. check:docs tests documentation against the deployment. The conformance suite is an independent, MIT-licensed test of protocol behavior.",
      },
    ],
    related: ["/docs/onboarding", "/trust", "/blog/one-dns-probe-and-a-complete-openapi", "/blog/removing-fabricated-verification"],
    updated: "2026-09-23",
  },

  // ---------------------------------------------------------------------------
  {
    slug: "register-an-agent-in-your-browser",
    published: "2026-09-14",
    commits: ["de83f5b", "798c75d"],
    tags: ["issuance", "cryptography", "release notes"],
    title: "Register an AI Agent in Your Browser",
    description:
      "/issue registers an AI agent in about a minute. The Ed25519 key is generated and used in your browser tab and never sent to AgenID. Here is how it works.",
    h1: "Register an agent in your browser, with a key that never leaves the tab",
    keywords: ["register AI agent", "AgenID issue", "browser Ed25519 signing", "client-side key custody"],
    lead: [
      "[/issue](/issue) registers an agent in about a minute. You name the agent, supply operator details and two disclosure attestations, and the browser generates an Ed25519 key, signs the manifest locally and sends only public material to `POST /api/v1/agents`. The response is `201 L1_REGISTERED`.",
      "The private key never leaves the tab. It is never written to `localStorage` or `sessionStorage`, a test enforces that, and a one-time download is the only persistence offered. Getting here also meant fixing a clock bug that would have rejected essentially every registration.",
    ],
    sections: [
      {
        heading: "How issuance works",
        body: [
          "The page builds a manifest from your inputs. The two behavioral attestations start `false`, because they are claims about how the agent behaves that no API can confirm; you set them yourself. The browser then signs a ManifestProof, which binds the manifest by SHA-256 digest, with Ed25519 over RFC 8785 canonical JSON.",
          "The registration route validates the manifest against the strict schema, checks the digest binding, the key role and controller, and the signature, and stores the record. After issuance the page offers the card link, the JSON envelope, an HTML embed, README markdown and a curl one-liner.",
        ],
      },
      {
        heading: "Client-side key custody",
        body: [
          "Browser signing uses `@noble/curves` with its own JCS implementation in `packages/web/lib/client-crypto.ts`. Cross-implementation tests prove that `@agenid/core` accepts a browser-produced proof. Two independent canonicalizers must agree byte for byte, or the protocol quietly forks.",
          "Server-side operator key generation was deleted outright rather than hardened. Its encryption helper silently wrote the key as plain hex whenever its secret was unset. The registry now never holds an operator private key, by construction.",
        ],
      },
      {
        heading: "The clock truncation bug",
        body: [
          "Both the write and read paths stripped fractional seconds from timestamps. Truncation only ever moves an instant backward, so a browser that signed and posted within the same second produced a `created_at` later than the registry's truncated now, and the registry rejected its own fresh proof as `not_yet_valid`. The same truncation on the read path would have rendered a brand-new agent's badge as PROOF INVALID.",
          "Truncation is gone. A bounded skew policy was added alongside: a proof created up to 120 seconds ahead of the registry is evaluated at its own `created_at`, and beyond that the request fails with `clock_skew_too_large`. `registered_at` is always the registry's clock, and proof verification itself remains strict.",
        ],
      },
      {
        heading: "What L1 means, and what it does not",
        body: [
          "L1_REGISTERED means the registry validated the schema, the digest binding and the operator's signature. It is a self-declaration and renders amber, never emerald. " +
            CEILING,
          IDENTITY_NOT_PERMISSION,
        ],
      },
      {
        heading: "How to try it",
        body: [
          "Open [/issue](/issue), register a test agent and save the key file when offered. Then resolve the identifier at [/verify](/verify) and re-check the envelope yourself. The [operator onboarding guide](/docs/onboarding) covers the command-line path, which signs locally in the same way.",
        ],
      },
    ],
    faqs: [
      {
        q: "Can AgenID recover my private key if I lose it?",
        a: "No. The key is generated in your browser and never sent to AgenID, so there is nothing to recover. Keep the one-time download safe.",
      },
      {
        q: "Why do the disclosure attestations start false?",
        a: "They describe behavior no API can observe. Defaulting them to true would sign a claim on your behalf that you never made.",
      },
      {
        q: "Is the registration permanent?",
        a: "The identifier is permanent. Agent status values exist in the schema, but no revocation or status-change flow is deployed today.",
      },
    ],
    related: ["/issue", "/verify", "/docs/onboarding", "/glossary/manifest-proof", "/blog/removing-fabricated-verification"],
    updated: "2026-09-23",
  },

  // ---------------------------------------------------------------------------
  {
    slug: "removing-fabricated-verification",
    published: "2026-09-14",
    commits: ["80672ca", "1a52a2c", "ea3ff9b"],
    tags: ["security", "integrity", "release notes"],
    title: "Removing Code That Faked Verification",
    description:
      "We found and removed code that asserted verification outcomes without computing them. What it did, what replaced it, and the tests that now enforce the standard.",
    h1: "Removing fabricated verification from our own codebase",
    keywords: ["fabricated verification", "AgenID integrity", "verification honesty", "AI agent verification security"],
    lead: [
      "A verification protocol is worth exactly as much as the claim that its outcomes are computed. This post describes code in AgenID's own repository that asserted verification outcomes without computing any, what replaced it, and the tests that now make the standard build-breaking rather than a matter of review.",
      "We are writing it up because the standard AgenID asks of others, that a verified state be produced by evidence and never by default, has to be the standard it holds itself to. The project's own record counts seven instances of fabricated verification claims reaching the repository, one of which shipped to production for a day.",
    ],
    sections: [
      {
        heading: "What was found",
        body: [
          "The largest instance was generated code: a command-line tool and three API routes that returned verification outcomes without computing them.",
        ],
        bullets: [
          "One route returned ORGANIZATION_VERIFIED for any domain submitted to it.",
          "A DNS token was hard-coded, identical for every user and every domain.",
          "Server-side key storage silently wrote operator keys as plain hex whenever its encryption secret was unset.",
          "A public onboarding page had every operator sign a fixed operator name, contact, purpose, and both disclosure attestations (`discloses_to_user`, `human_escalation`) preset to true, under their own key.",
          "DECLARED, which sits below L1, rendered in Verified Emerald with confetti.",
        ],
      },
      {
        heading: "What replaced it",
        body: [
          "The stubs were replaced with real Ed25519 paths that report DECLARED and nothing above it. The command-line tool now generates real keys, builds manifests from explicit operator attestations, signs a ManifestProof over RFC 8785 canonical bytes, writes the private key with `0600` permissions and never prints it.",
          "Server-side operator key generation was deleted outright rather than hardened, so the registry never holds an operator private key. The onboarding page now collects the operator's own identity and attestations instead of signing fixed ones. DECLARED renders amber, and the panel states plainly that no third party has checked the claims.",
        ],
      },
      {
        heading: "Smaller claims that were also untrue",
        body: [
          "Dead and out-of-namespace hosts were removed from public copy. Endpoints that were not deployed, the second key-discovery path and the assertion write path at the time, were labelled as not deployed in the docs, the homepage diagram and every Verification Card's instructions. A privacy escrow feature described on the site did not exist and was removed. The root package guard that prevents publishing the whole monorepo by accident was restored.",
        ],
      },
      {
        heading: "Making the standard a test",
        body: [
          "`packages/web/test/public-surface.test.ts` turns each of these into a build-breaking assertion. A later sweep found two more defaulted attestations, registration implemented twice, and the presentation layer deciding trust state, which led to the [fail-closed presentation](/blog/trust-presentation-fails-closed) change. The rule it all comes down to is simple: a level, a badge or a sentence may claim only what was computed from evidence.",
          "The same rule sets the ceiling every AgenID page states. " + CEILING,
        ],
      },
      {
        heading: "What it means for operators and verifiers",
        body: [
          "For operators, the lesson is to sign only what you mean: at [/issue](/issue) the behavioral attestations start false and must be set deliberately. For verifiers, the lesson is the protocol's own design: do not take a displayed level on faith. Resolve the envelope and re-verify it, as described in [how to verify an AI agent](/learn/how-to-verify-an-ai-agent). " +
            IDENTITY_NOT_PERMISSION,
        ],
      },
    ],
    faqs: [
      {
        q: "Did any agent receive a real level above L1 because of these stubs?",
        a: "No level above L1 can be signed, because no root authority key exists. The stubs asserted outcomes in responses and on screen; they could not produce a valid signed assertion.",
      },
      {
        q: "How do I know the current code computes what it reports?",
        a: "You do not have to trust it. The envelope carries signatures you can re-verify offline, and the registry cannot forge an operator signature.",
      },
      {
        q: "Why publish this at all?",
        a: "Because a verification protocol that hides its own integrity failures is asking for a trust it has not earned. The fixes and the tests are the useful part.",
      },
    ],
    related: ["/trust", "/learn/how-to-verify-an-ai-agent", "/blog/trust-presentation-fails-closed", "/blog/register-an-agent-in-your-browser", "/glossary/declared-verified-authorized"],
    updated: "2026-09-23",
  },
];
