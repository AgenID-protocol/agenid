---
title: "AgenID: Verifiable, Portable Identity for AI Agents"
abbrev: "AgenID"
docname: draft-morgan-agenid-agent-identity-00
category: info
ipr: trust200902
area: "Applications and Real-Time"
submissiontype: IETF
v: 3
date: 2026-09-23
keyword:
 - AI agents
 - agent identity
 - Ed25519
 - JSON Canonicalization Scheme
 - key discovery
 - well-known URI

author:
 -
    ins: M. Morgan
    name: M. Morgan
    organization: AI Venture Holdings LLC
    email: mike@mmivip.com

normative:
  RFC2119:
  RFC8174:
  RFC8785:
  RFC8032:
  RFC3339:
  RFC8615:
  RFC4648:
  RFC3986:
  RFC6234:
  RFC8259:
  ULID:
    title: "ULID: Universally Unique Lexicographically Sortable Identifier"
    target: https://github.com/ulid/spec
    author:
      -
        org: ULID specification contributors
    date: false

informative:
  RFC9421:
  RFC7942:
  RFC8792:
  AGENID-SPEC:
    title: "AgenID v1.1.1 Protocol Specification, with Errata E1 and E2"
    target: https://github.com/AgenID-protocol/spec
    author:
      -
        org: AI Venture Holdings LLC
    date: 2026-09-13
  AGENID-CONFORMANCE:
    title: "AgenID Conformance Suite"
    target: https://github.com/AgenID-protocol/conformance
    author:
      -
        org: AI Venture Holdings LLC
    date: 2026

--- abstract

AgenID is a protocol that lets a third party check which operator key
signed a set of statements about an AI agent, when it was signed, and
whether any named verification authority has attested to specific
claims about that agent -- without trusting the registry that stores
and serves those statements. This document describes AgenID protocol
version 1.1.1: agent and key identifiers, a single signing construction
using the JSON Canonicalization Scheme (RFC 8785) and pure Ed25519
(RFC 8032), the Manifest, ManifestProof, KeyDocument,
VerificationAssertion and AuthoritiesDocument objects, verification
levels, two-path key discovery using a well-known URI, the resolution
envelope, and the verification procedures.

This is an individual draft prepared for discussion. It has not been
submitted to the IETF Datatracker. It describes protocol version 1.1.1
as published at the specification repository, which remains
authoritative wherever this document and that specification differ.

--- note_Status_of_This_Draft

This document is an individual draft prepared for discussion. It has
NOT been submitted to the IETF Datatracker and has no standing in any
IETF working group.

It restates AgenID protocol version 1.1.1, with Errata E1 and E2
applied, as published in {{AGENID-SPEC}}. That specification is
authoritative. Where this document and {{AGENID-SPEC}} differ, the
specification governs and the difference is a defect in this document.
This document does not change, add or weaken any normative requirement
of the specification. Where the specification is silent, this document
says so rather than filling the gap.

--- middle

# Introduction

Software agents built on large language models increasingly place
telephone calls, send messages, and call APIs on behalf of
organizations. A party receiving such an interaction usually has no
portable way to learn who operates the agent, or to check a claim about
the agent without trusting whoever presents the claim.

AgenID addresses a narrow part of that problem. It lets an operator
publish a signed self-declaration (a Manifest bound by a ManifestProof)
about a persistent agent identifier, and lets a verification authority
publish signed attestations (VerificationAssertions) about specific
claims, each bound to one manifest version. A verifier can re-check
every signature, every digest binding and every key role itself. The
registry that stores and serves this material is a convenience: a
verifier that follows the procedures in {{verification}} detects a
registry that alters signed material, substitutes an operator key that
the operator's own domain does not publish, or reports a level that no
valid assertion supports.

The protocol establishes signature authenticity and integrity over a
canonical serialization. It does not establish that the signed
statements are true. A verification level describes how an identity
was checked; it is not a statement of compliance, safety, or
authorization. Which agent is acting is a different question from what
that agent is allowed to do, and version 1.1.1 defines no signed object
that answers the second question ({{claim-states}}).

## Relationship to the Specification

The normative definition of AgenID v1.1.1 is {{AGENID-SPEC}}. Two
errata are applied:

E1:
: The number-domain rule of the canonicalization profile is defined on
  the RFC 8785 canonical token rather than on a host-language number
  type ({{number-domain}}).

E2:
: The schema and authority namespace is unified on `agenid.com`. All
  `$schema` URIs in signed objects use `https://agenid.com/schemas/...`,
  and the authority registry document is served under `agenid.com`.
  Because `$schema` is part of the signing input, E2 changed the signed
  bytes of every test vector.

Section numbers of the form "spec Section N" in this document refer to
{{AGENID-SPEC}}.

## Scope

In scope: identifiers, canonicalization and signing, the signed and
unsigned protocol objects, verification levels, key discovery, trust
anchors, the resolution envelope, the verification procedures, and
outcome codes.

Out of scope, because the specification does not define them in
v1.1.1: authorization of agent actions, delegation between authority
keys, binding of a live request or session to an agent, the L4
evidence methodology, and any platform-specific adapter mapping.

# Conventions and Definitions

{::boilerplate bcp14-tagged}

The specification states several requirements with the upper-case
keyword "MUST" and states its verification procedures as imperative
steps ("require ...", "reject ..."). This document uses BCP 14 keywords
only where the specification itself states a requirement with such a
keyword, and reproduces imperative procedure steps in imperative form
without converting them to BCP 14 keywords.

JSON is as defined in {{RFC8259}}. Timestamps are RFC 3339
{{RFC3339}} strings in UTC. "base64url" is the URL-safe alphabet of
{{Section 5 of RFC4648}} without padding. SHA-256 is as specified in
{{RFC6234}}.

# Terminology

Agent:
: A persistent logical AI identity, named `agenid:<ULID>`. An Agent is
  never re-keyed by a platform, configuration, or deployment change.

Deployment:
: One concrete execution of an Agent on a platform or channel. It has a
  platform-scoped identifier distinct from the Agent identifier.

Operator:
: The legal or operational entity accountable for an Agent. The
  hosting platform is never the Operator by virtue of hosting.

Verification Authority (Authority):
: A named party that performs verification and signs
  VerificationAssertions with an `authority`-role key. Authority
  identifiers have the form `agenid:authority:<node>`. The model admits
  authorities other than the specification's publisher without a
  protocol change.

Key Role:
: Every key document declares exactly one role, `operator` or
  `authority`. The role is enforced at verification time.

Manifest:
: The Operator's canonical-JSON self-declaration about an Agent. It is
  plain JSON (not JSON-LD) and carries DECLARED content only. It is
  never signed directly.

ManifestProof:
: An Operator-signed object binding an Agent identifier to a manifest
  digest.

VerificationAssertion:
: An Authority-signed attestation over one claim, one evidence item,
  one level, one scope, and one validity window, bound to one manifest
  digest.

Key Document:
: A JSON object describing one public key, its role, its controller,
  and its lifecycle status.

Keys Document:
: A JSON object listing the key documents that one domain vouches for,
  served at the well-known location defined in {{keydisc}}.

Authorities Document:
: A JSON document listing recognized Verification Authorities and
  their root keys ({{authorities-doc}}).

Root authority key:
: The key that signs the Authorities Document, whose public value and
  key identifier verifiers pin out of band ({{trust-anchors}}).

DECLARED, VERIFIED, AUTHORIZED:
: Three claim states that are never inferred from one another
  ({{claim-states}}).

Verification Level:
: A property of a VerificationAssertion ({{levels}}).

Status:
: A property of an Agent or a Deployment ({{status-model}}).
  Orthogonal to level.

Registry:
: A service that validates, stores and serves public protocol material.
  It holds no private keys, and verifiers do not trust it.

Resolver:
: The function that maps an Agent identifier to the material needed
  for verification ({{envelope}}).

Verifier:
: Any party that resolves an identity and re-checks it.

Adapter:
: A component that maps a platform's agent configuration into protocol
  objects. Adapter output is DECLARED-equivalent only.

Logical form / wire form:
: The two normative representations of key and assertion identifiers
  ({{logical-wire}}).

# Protocol Overview

~~~ ascii-art
  Operator                   Registry                  Verifier
  --------                   --------                  --------
  generate Ed25519 key
  (role "operator");
  write Manifest M;
  sign ManifestProof
  binding sha256(JCS(M))
     |
     | M, ManifestProof,
     | KeyDocument
     +---------------------->  validate, verify
                               proof, store
                                   |
                                   | envelope: M, proof,
                                   | assertions, key
                                   | discovery pointers
                                   +--------------------->  (1)
                                   |
                                   | key document via
                                   | GET /v1/keys/{ULID}
                                   +--------------------->  (2)
  publish Keys Document
  at https://<operator_domain>/.well-known/agenid/keys.json
     |
     +------------------------------------------------->   (3)

  Verifier, after (1)-(3): recompute the digest; verify signatures;
  enforce role and controller; check windows; require the two key
  copies to agree; decide which Authorities to trust via the pinned
  root key; compute the level from assertions that pass.

  Authority (none exists in the reference deployment): signs
  VerificationAssertions with an "authority"-role key, each bound to
  sha256(JCS(M)) of one manifest version.
~~~
{: title="Actors and data flow"}

An Operator generates an Ed25519 key pair and publishes a key document
whose `role` is `operator` and whose `controller` is the Agent
identifier. The Operator writes a Manifest, computes the SHA-256 digest
of its canonical form, and signs a ManifestProof that carries that
digest. The Manifest, the ManifestProof, and the key document are
submitted to a Registry.

A Verification Authority, if one exists, evaluates a specific claim
(for example, control of a domain) against specific evidence and signs
a VerificationAssertion that names the claim, the evidence pointer, the
level, the scope, a validity window, and the manifest digest it applies
to.

A Verifier resolves the Agent identifier to an envelope containing the
Manifest, the ManifestProof, the VerificationAssertions and key
discovery pointers. The Verifier recomputes the digest, verifies every
signature, enforces key roles and controllers, checks validity windows,
obtains each key from two independent discovery paths and requires
that they agree, decides whether it trusts each named Authority via a
pinned root key, and computes the level itself.

# Identifiers {#identifiers}

## Agent Identifiers

An Agent identifier is the string `agenid:` followed by a ULID
{{ULID}}: 128 bits, encoded as 26 characters of Crockford Base32. It
matches the regular expression:

~~~
^agenid:[0-9A-HJKMNP-TV-Z]{26}$
~~~

An Agent identifier is immutable for the life of the record, including
through the `REVOKED` status, and is never reissued. It is
non-semantic: a platform-native identifier MUST NOT be used as, encoded
into, or derived into an `agenid:` identifier. Registration MUST
perform a uniqueness check before commit, regardless of the collision
resistance of ULIDs.

## Identifier Namespaces

The complete list of identifier namespaces in v1.1.1:

| Prefix | Meaning |
|---|---|
| `agenid:` | Agent |
| `agenid:key:` | Key (the key's own ULID) |
| `agenid:authority:` | Verification Authority |
| `assertion:` | VerificationAssertion |
| `dep_` | Deployment (platform-scoped, opaque) |
{: title="Identifier namespaces (spec Section 2)"}

Examples from the specification, in the same order:

~~~
agenid:01J8Z3K3F2QZ9X6V7R4T8N2W5Y
agenid:key:01J8Z3M9Q4XK2P7VBN6TDR8HWE
agenid:authority:node-01
assertion:01J8Z3P2K8VW4RN7XTQ6MYD5HC
dep_a1b2c3
~~~

The prefix `agenid:operator:<ULID>`, for operator-level keys spanning
many agents, is reserved and not used in v1.1.1. In v1.1.1 the
`controller` of an operator key is an `agenid:` Agent identifier.

The specification gives a grammar for Agent and key identifiers. It
does not give a grammar for the `<node>` part of an Authority
identifier or for the body of a `dep_` identifier beyond "opaque".

## Key Identifiers: Logical and Wire Forms {#logical-wire}

A key has its own ULID. A key identifier is `agenid:key:<key-ULID>`.
It carries no fragment and encodes no relationship to any Agent's
ULID; which Agent or Authority controls a key is stated by the key
document's `controller` member ({{keydoc}}).

The specification defines two representations, both normative:

Logical form:
: Used inside signed payloads, for example
  `agenid:key:01J8Z3M9Q4XK2P7VBN6TDR8HWE`.

Wire form:
: Used in HTTP paths: the bare key ULID, for example
  `01J8Z3M9Q4XK2P7VBN6TDR8HWE`. It is path-safe by construction.

The reason for the split is that a URI fragment is never transmitted
in an HTTP request ({{Section 3.5 of RFC3986}}). An earlier draft of
the specification used `#`-suffixed key identifiers, which made every
key under one prefix collide at the server.

The rules for key resolution (spec Sections 0.A and 9.2):

* `GET /v1/keys/{key-ULID}` is the canonical resolver path.

* `GET /v1/keys?key_id={percent-encoded logical form}` MUST also be
  accepted and MUST return the identical document.

* Servers MUST reject a `key_id` containing `#` with HTTP status 400
  and error `invalid_key_id`; they never silently truncate.

Assertion identifiers follow the same rule: the wire form is the bare
ULID, resolved at `GET /v1/assertions/{assertion-ULID}`.

The specification text writes these resolver URLs with a fixed
registry hostname. This document writes the host as a variable,
`<registry-host>`. See {{impl-status}} for the host the reference
deployment uses.

# Canonicalization and Signatures {#canon}

## Canonicalization

Every object that is hashed or signed is canonicalized with the JSON
Canonicalization Scheme (JCS) {{RFC8785}}, starting from a parsed data
structure. Canonical bytes are never produced by editing
pre-serialized text.

The specification records the following behavior as executed test
results (spec Section 8.7), and implementations MUST reproduce those
vectors byte-for-byte:

* Non-ASCII characters are emitted as raw UTF-8, not as `\uXXXX`
  escapes.

* Only `"`, `\`, and control characters U+0000 through U+001F are
  escaped, using the RFC 8785 short forms (such as `\n` and `\t`) or
  `\u00XX`. U+007F and U+00A0 are emitted raw.

* Object members are sorted by UTF-16 code units, not by locale or by
  the first byte of the UTF-8 encoding.

* `1.0` canonicalizes to `1`, `-0.0` to `0`, `1e21` to `1e+21`, `1e-7`
  to `1e-7`, and `0.000001` to `0.000001`.

## Number Domain (Erratum E1) {#number-domain}

The rule is defined on the RFC 8785 canonical token of a number, not on
the host language's number type. A number MUST be rejected at
validation, with `invalid_number_domain`, if either:

* it is non-finite; or

* its canonical token is an integer literal (it contains neither `.`
  nor `e`) with magnitude greater than 2^53 - 1 (9007199254740991).

Exponent-form tokens such as `1e+21` and `1e+100` are accepted. `NaN`,
`Infinity` and `-Infinity` MUST be rejected. Consequences:
`9007199254740991` is accepted; `9007199254740992` is rejected; `1e20`
(canonical token `100000000000000000000`) is rejected; `1e21`
(canonical token `1e+21`) is accepted.

As a design rule, no field of any v1.1.1 schema is a number:
timestamps are RFC 3339 strings, digests are hexadecimal strings, and
identifiers are strings. The number-domain rule exists so that
conformant documents never reach these edge cases.

## Manifest Digest

The manifest digest is SHA-256 over the JCS canonical bytes of the
Manifest, carried as:

~~~ json
{ "alg": "sha-256", "value": "<64 hexadecimal characters>" }
~~~

`sha-256` is the only `alg` value the specification defines. The
specification does not state the letter case of `value`; every vector
it publishes uses lower case.

This digest is a data value inside signed payloads. It is bound by the
signature; it is not the message that is signed.

## The Signing Construction {#signing}

Both signed object types, ManifestProof and VerificationAssertion, use
one construction (spec Section 7). Given a signed object S as a parsed
JSON object:

1. Remove the `signature` member, if present, giving the payload P.

2. Canonicalize P with JCS, giving `signing_input` (UTF-8 bytes).

3. Compute `sig = Ed25519.Sign(private key for P.key_id,
   signing_input)`, 64 bytes.

4. S is P plus the member `"signature": base64url(sig)`, without
   padding.

Properties of this construction:

* It is pure Ed25519 (PureEdDSA, {{RFC8032}}). The bytes passed to
  Ed25519 are exactly `signing_input`. Ed25519ph is not used, and no
  external SHA-512 or SHA-256 pre-hash of the payload is computed.

* The `$schema` member is part of the signing input. Changing the
  schema URI invalidates the signature.

* Only `signature` is excluded. A verifier that includes `signature` in
  the canonicalized input fails verification (spec Section 8.6, case
  e).

# Objects {#objects}

Field tables in this section are taken from spec Sections 6 and 9. The
normative JSON Schemas are published with the specification at
`https://agenid.com/schemas/v1.1.1/manifest.json`, `manifest-proof.json`,
`assertion.json`, `keys.json` and `authorities.json` (spec Section 20).
Where this section says a constraint is not stated, the constraint may
exist in those schema files; this document does not reproduce them.

## Manifest {#manifest}

The Manifest is the Operator's self-declaration. It is never signed
directly; it is bound by digest from the ManifestProof and from every
VerificationAssertion. This keeps it freely readable and cacheable and
lets many assertions reference one manifest version without re-signing
it.

~~~ json
{
  "manifest_version": "1.0",
  "agent_id": "agenid:<ULID>",
  "identity":   { "name": "...", "description": "..." },
  "ownership":  { "operator": "...", "operator_domain": "hostname",
                  "contact": "email" },
  "purpose":    { "summary": "...", "channels": ["voice", "sms"] },
  "disclosure": { "is_ai": true, "discloses_to_user": true,
                  "human_escalation": true }
}
~~~
{: title="Manifest shape (spec Section 6.1)"}

| Member | Type as stated | Notes |
|---|---|---|
| `manifest_version` | string | `"1.0"` |
| `agent_id` | string | Agent identifier |
| `identity.name` | string | |
| `identity.description` | string | |
| `ownership.operator` | string | Operator name |
| `ownership.operator_domain` | hostname | Domain used for operator key discovery ({{keydisc}}) |
| `ownership.contact` | email | |
| `purpose.summary` | string | |
| `purpose.channels` | array | Values from `voice`, `sms`, `chat`, `email`, `api` |
| `disclosure.is_ai` | boolean | Operator attestation |
| `disclosure.discloses_to_user` | boolean | Operator attestation |
| `disclosure.human_escalation` | boolean | Operator attestation |
{: title="Manifest members"}

The schema sets `additionalProperties: false`. The reserved keys
`platform`, `permissions`, `jurisdictions`, `status`,
`change_history`, `authorizations`, and `configuration_fingerprint` are
rejected by a v1.1.1 validator. A prohibited-content rule is enforced
at validation. The specification refers to an earlier draft for the
full manifest schema and for the prohibited-content rule, and states
that the configuration-fingerprint boundary language (a fingerprint is
not a behavioral, safety or compliance proof) carries forward and
applies to any future VerificationAssertion whose evidence references
a fingerprint.

The specification describes the schema as having "five core fields"
while the shape above has six top-level members. Which members are
required, and any length or format constraints beyond those shown, are
not stated in the v1.1.1 text.

The `disclosure` members are claims about the agent's real behavior
that no party, including the Registry, can check. They are DECLARED
content.

## ManifestProof {#manifestproof}

~~~ json
{
  "$schema": "https://agenid.com/schemas/v1.1.1/manifest-proof.json",
  "proof_type": "manifest_self_declaration",
  "agent_id": "agenid:01J8Z3K3F2QZ9X6V7R4T8N2W5Y",
  "manifest_version": "1.0",
  "manifest_digest": { "alg": "sha-256", "value": "<64 hex>" },
  "key_id": "agenid:key:<key-ULID>",
  "created_at": "RFC3339 UTC",
  "expires_at": "RFC3339 UTC",
  "signature": "<base64url, no padding, 64 bytes>"
}
~~~
{: title="ManifestProof (spec Section 6.2)"}

| Member | Value |
|---|---|
| `$schema` | `https://agenid.com/schemas/v1.1.1/manifest-proof.json` (signed) |
| `proof_type` | Fixed enumeration; `manifest_self_declaration` is the only value in v1.1.1 |
| `agent_id` | Agent identifier |
| `manifest_version` | Manifest version the digest covers |
| `manifest_digest` | `{ "alg": "sha-256", "value": <64 hex> }` over JCS(Manifest) |
| `key_id` | Logical key identifier of the signing key |
| `created_at` | RFC 3339 UTC |
| `expires_at` | RFC 3339 UTC |
| `signature` | base64url, no padding, of the 64-byte Ed25519 signature |
{: title="ManifestProof members"}

Every member except `signature` is signing input. `key_id` MUST resolve
to a key document with `role` equal to `operator` and `controller`
equal to `agent_id`. A ManifestProof produces DECLARED and never more.

## VerificationAssertion {#assertion}

~~~ json
{
  "$schema": "https://agenid.com/schemas/v1.1.1/assertion.json",
  "assertion_id": "assertion:01J8Z3P2K8VW4RN7XTQ6MYD5HC",
  "subject": "agenid:01J8Z3K3F2QZ9X6V7R4T8N2W5Y",
  "subject_type": "agent",
  "level": "L2_DOMAIN_VERIFIED",
  "claim": { "type": "domain_control", "domain": "acmemedical.com" },
  "authority": "agenid:authority:node-01",
  "evidence": { "type": "dns_txt_challenge",
                "reference": "_agenid-challenge.acmemedical.com" },
  "verified_at": "2026-09-13T06:00:00Z",
  "expires_at": "2026-10-13T06:00:00Z",
  "scope": "domain_control_only",
  "manifest_digest": { "alg": "sha-256", "value": "<64 hex>" },
  "key_id": "agenid:key:<key-ULID>",
  "signature": "<base64url, no padding, 64 bytes>"
}
~~~
{: title="VerificationAssertion (spec Section 6.3)"}

| Member | Allowed values or meaning |
|---|---|
| `$schema` | `https://agenid.com/schemas/v1.1.1/assertion.json` (signed) |
| `assertion_id` | `assertion:<ULID>` |
| `subject` | Agent identifier, or `dep_` identifier when `subject_type` is `deployment` |
| `subject_type` | `agent`, `deployment` |
| `level` | `L1_REGISTERED`, `L2_DOMAIN_VERIFIED`, `L3_ORGANIZATION_VERIFIED`, `L4_DEPLOYMENT_VERIFIED` |
| `claim.type` | `registration`, `domain_control`, `organization_identity`, `deployment_conformance` |
| `authority` | Authority identifier |
| `evidence.type` | `schema_validation`, `dns_txt_challenge`, `http_wellknown_challenge`, `business_registry_match`, `document_review`, `deployment_sample_review` |
| `evidence.reference` | A pointer (DNS name, registry identifier, opaque review identifier), never evidence content |
| `verified_at` | RFC 3339 UTC |
| `expires_at` | RFC 3339 UTC |
| `scope` | String; MUST be one of the Authority's published scope identifiers |
| `manifest_digest` | Digest of the manifest version the assertion is bound to |
| `key_id` | Logical identifier of the Authority key that signed it |
| `signature` | base64url, no padding, of the 64-byte Ed25519 signature |
{: title="VerificationAssertion members"}

Rules stated by the specification:

* `key_id` MUST resolve to a key document with `role` equal to
  `authority` and `controller` equal to the value of `authority`.

* `evidence.reference` MUST be a pointer, never content (spec Sections
  6.3 and 17).

* `subject_type: "deployment"` requires `subject` to be a `dep_`
  identifier and `level` to be `L4_DEPLOYMENT_VERIFIED`.

* A fifth level name, L5, is reserved. It MUST NOT be issued in v1.1.1
  ({{levels}}).

* The schema sets `additionalProperties: false`. `evidence`,
  `authority`, `scope`, `verified_at`, `expires_at`, `level` and
  `subject` are required members (spec Section 21, Gate 3).

The specification does not state where an Authority publishes its
scope identifiers, and does not define members of `claim` other than
`type` beyond the `domain` member shown in its example.

## Key Document {#keydoc}

~~~ json
{
  "key_id": "agenid:key:01J8Z3M9Q4XK2P7VBN6TDR8HWE",
  "key_type": "Ed25519",
  "public_key_b64u": "C2XCaQ41IZoFum-4PbNJ1aUCevSZwClSzjyZ-x85T3g",
  "role": "operator",
  "controller": "agenid:01J8Z3K3F2QZ9X6V7R4T8N2W5Y",
  "created_at": "2026-09-13T00:00:00Z",
  "status": "active",
  "retired_at": null,
  "revoked_at": null
}
~~~
{: title="Key document (spec Section 9.1)"}

| Member | Value |
|---|---|
| `key_id` | Logical key identifier |
| `key_type` | `Ed25519` |
| `public_key_b64u` | base64url, no padding, of the 32-byte public key |
| `role` | `operator` or `authority` |
| `controller` | Agent identifier (operator keys) or Authority identifier (authority keys) |
| `created_at` | RFC 3339 UTC |
| `status` | `active`, `retired`, `revoked` |
| `retired_at` | RFC 3339 UTC or `null` |
| `revoked_at` | RFC 3339 UTC or `null` |
{: title="Key document members"}

Key documents are not signed in v1.1.1. They are trusted through their
discovery path ({{keydisc}}). Retired and revoked keys remain
resolvable indefinitely so that historical proofs stay verifiable.

## Keys Document

Served at the well-known location defined in {{keydisc}}:

~~~ json
{
  "$schema": "https://agenid.com/schemas/v1.1.1/keys.json",
  "controller_domain": "acmemedical.com",
  "keys": [ { "...": "key document" }, { "...": "key document" } ]
}
~~~
{: title="Keys document (spec Section 9.3)"}

| Member | Value |
|---|---|
| `$schema` | `https://agenid.com/schemas/v1.1.1/keys.json` |
| `controller_domain` | The domain serving the document |
| `keys` | Array of key documents the domain vouches for |
{: title="Keys document members"}

## Authorities Document {#authorities-doc}

The Authorities Document is served at
`https://agenid.com/.well-known/agenid/authorities.json`. For every
recognized Authority it lists:

| Member | Value |
|---|---|
| `authority_id` | Authority identifier (`agenid:authority:<node>`) |
| `authority_domain` | Domain at which that Authority's keys are discovered |
| `root_key_id` | Logical key identifier of the root key |
| `root_public_key_b64u` | base64url public key of the root key |
{: title="Authorities Document entry members (spec Section 9.5)"}

The specification states that the document is itself signed "as a
VerificationAssertion with `claim.type: "authority_registry"`
(reserved value)" by the AgenID root authority key. The v1.1.1 text
does not state:

* the enclosing structure of the document (for example, the member
  that holds the list of entries);

* how a VerificationAssertion covers the document (whether the
  document embeds the assertion, or the assertion references the
  document by digest);

* the values of `subject`, `subject_type`, `level`, `evidence` and
  `manifest_digest` for such an assertion, given that
  `authority_registry` is not among the enumerated `claim.type` values
  in spec Section 6.3.

The standalone `authorities.json` schema published with the
specification may resolve some of these points; this document does
not reproduce it.

## Deployment Record and Status Model {#status-model}

A Deployment record is DECLARED metadata. It is not signed in v1.1.1
and is bound to L4 assertions by digest. Its fields are not restated in
the v1.1.1 text, and the L4 evidence model remains open.

Binding rules for Deployments (spec Section 3):

1. Creating, changing or deleting a Deployment MUST NOT alter
   `agent_id`, `manifest_version`, or any existing ManifestProof or
   VerificationAssertion.

2. A Deployment carries its own status and its own L4 assertion. The
   parent Agent's L1 to L3 assertions are unaffected.

3. Platform migration is: retire Deployment A (Deployment-level
   `REVOKED`), then create Deployment B under the same `agent_id`.

4. A manifest change touching a claim already covered by an L2 or L3
   assertion sets the Agent status to `CHANGED`. It does not invalidate
   the old assertion's signature; it makes the assertion not applicable
   to the new manifest version.

Status values are `ACTIVE`, `CHANGED`, `STALE`, `SUSPENDED` and
`REVOKED`, tracked independently at the Agent and Deployment level.
`REVOKED` identities are permanent and remain publicly resolvable.
`CHANGED` is defined mechanically: the current manifest digest differs
from the `manifest_digest` of at least one otherwise-valid L2-or-higher
assertion. The v1.1.1 text does not restate the conditions for `STALE`
or `SUSPENDED`.

## Event Ledger

The specification defines an append-only event ledger holding hashes
and references only. v1.1.1 adds the event types `assertion.issued`,
`assertion.expired` and `key.retired` to `key.rotated` and
`key.revoked`. Every `assertion.issued` event carries `assertion_id`
and the assertion's `manifest_digest`, never the evidence.

# Verification Levels and Claim States {#levels}

## Claim States {#claim-states}

The three claim states are separated by object, not by a field value:

| State | Produced only by | Object |
|---|---|---|
| DECLARED | Operator | Manifest plus ManifestProof |
| VERIFIED | Authority | VerificationAssertion |
| AUTHORIZED | none | No signed object in v1.1.1; reserved for v1.2 |
{: title="Claim states (spec Section 4)"}

~~~
DECLARED            does NOT imply       VERIFIED
VERIFIED            does NOT imply       AUTHORIZED
PLATFORM_CONFIGURED does NOT imply       AUTHORIZED
operator-signed     does NOT produce     VERIFIED
authority-signed    does NOT produce     DECLARED
~~~

No field in v1.1.1 changes a claim from DECLARED to VERIFIED by its
value alone. The transition is the existence of a valid, in-window,
role-correct VerificationAssertion whose `manifest_digest` matches the
current manifest.

## Levels {#level-list}

DECLARED is a claim state, not a level: it is what a valid
ManifestProof establishes, and nothing more. Levels are properties of
VerificationAssertions, and each level is issued only as a
VerificationAssertion (spec Section 11):

| Level | `subject_type` | `claim.type` |
|---|---|---|
| `L1_REGISTERED` | agent | `registration` |
| `L2_DOMAIN_VERIFIED` | agent | `domain_control` |
| `L3_ORGANIZATION_VERIFIED` | agent | `organization_identity` |
| `L4_DEPLOYMENT_VERIFIED` | deployment | `deployment_conformance` |
| L5 (reserved name) | none | none; never issued in v1.1.1 |
{: title="Level mapping (spec Section 11)"}

Typical `evidence.type` values per level, as listed by the
specification: L1, `schema_validation`; L2, `dns_txt_challenge` or
`http_wellknown_challenge`; L3, `business_registry_match` or
`document_review`; L4, `deployment_sample_review`.

L5 is reserved. The specification defines its name only; it MUST NOT
be issued in v1.1.1, and no continuous-integrity claim is made. The
exact reserved string is given in spec Section 6.3.

The specification leaves the L4 methodology open: the sampling method,
sample size and pass criteria for `deployment_sample_review` are to be
specified before L4 can be issued. The L4 assertion format itself is
defined.

A verification level is not a statement of compliance. Each level says
only that the named Authority asserted the named claim, against the
named evidence pointer, within the named scope and window, about one
manifest version. A result of VERIFIED at a level implies nothing
outside the assertion's `scope`.

The specification does not define how a verifier combines several
valid assertions into a single "current level" for an Agent.
Implementations report the highest level among assertions that pass
verification ({{envelope}}).

# Key Discovery {#keydisc}

## Two Paths

A key document is obtained from two paths:

Registry path:
: `GET https://<registry-host>/v1/keys/{key-ULID}` returns the key
  document as `application/json`.
  `GET https://<registry-host>/v1/keys?key_id={percent-encoded logical
  id}` returns the identical document. A `key_id` containing `#`
  yields `400 invalid_key_id` ({{logical-wire}}).

Domain path:
: For operator keys, `https://<ownership.operator_domain>/.well-known/agenid/keys.json`.
  For authority keys, `https://<authority_domain>/.well-known/agenid/keys.json`,
  where `authority_domain` comes from the Authorities Document. Both
  use the Keys Document schema. The document is served over HTTPS with
  a valid certificate for the domain.

One document per domain lists every key the domain controls.
Per-key files are not used.

The operator-hosted Keys Document is what makes an operator key
domain-bound. An L2 assertion states that the Operator controls the
domain; the well-known file states which keys that domain vouches for.

## Agreement Rule

The verification procedures ({{verification}}) resolve `key_id` through
both paths and require that both paths agree. Disagreement is
`key_discovery_mismatch`.

The specification does not define what "agree" compares (the full key
document, or selected members such as `public_key_b64u`, `role`,
`controller` and `status`), and does not state the outcome when the
domain path is unreachable or returns no document. A verifier holding
only one copy has one source, not two, and the key-substitution
defense described in {{sec-registry}} is not in force for that key.

## Key Lifecycle

Rotation creates a new key with a new ULID; the old key becomes
`retired` with `retired_at` set. Proofs created before `retired_at`
remain valid. `revoked_at` invalidates proofs created after it,
regardless of signature validity. `expires_at` inside every signed
payload is checked independently of key status. Re-attestation issues
a new signed object and never mutates an old one.

## Trust Anchors {#trust-anchors}

A verifier needs two things it cannot derive from a signature: which
domain an `agenid:authority:*` identifier maps to, and an initial
reason to trust that domain's Keys Document. The specification
provides both:

* The Authorities Document ({{authorities-doc}}) maps each Authority to
  its domain and root key, and is signed by the AgenID root authority
  key.

* The AgenID root authority key's public value and `key_id` are
  published in the specification's repository as the out-of-band
  channel, and MUST be pinned by verifiers.

TLS to `agenid.com` is the online path; the pinned root key is the
offline anchor. Both paths are normative, and disagreement between them
is `trust_anchor_mismatch`, a hard failure. A verifier that relies only
on TLS is trusting the publisher's infrastructure; a verifier that also
checks the pin is verifying independently.

The specification describes the production root key as not yet
generated, and records its generation, HSM storage, and publication of
the pin as an operational pre-launch task.

# Resolution Envelope {#envelope}

## What the Specification Requires

Resolving `agenid:<ULID>` yields an HTML representation, a JSON
representation, and material consisting of the ManifestProof, the
VerificationAssertions, and key discovery pointers sufficient to run
the procedures in {{verification}} without further trust in the
resolver (spec Section 15). The specification states that content
negotiation is unchanged from an earlier draft and does not restate it,
and does not define the member layout of the JSON representation.

The specification defines these registry resources (spec Section 14),
under a single `/v1` prefix:

| Resource | Returns |
|---|---|
| `GET /v1/keys/{key-ULID}` | Key document |
| `GET /v1/keys?key_id={percent-encoded logical id}` | Identical key document |
| `GET /v1/agents/{agent_id}/proof` | Current ManifestProof |
| `GET /v1/agents/{agent_id}/assertions` | All VerificationAssertions, current and expired (flagged), each a complete signed object |
| `GET /v1/assertions/{assertion-ULID}` | One VerificationAssertion |
{: title="Registry resources (spec Sections 9.2 and 14)"}

Other API resources are described as unchanged from an earlier draft
and are not restated in v1.1.1.

## Reference Implementation Layout (Informative)

The reference implementation ({{impl-status}}) returns the following
JSON envelope. This layout is not defined by the specification and is
shown for information:

~~~ json
{
  "agenid_envelope_version": "1.0",
  "agent_id": "agenid:01J...",
  "status": "ACTIVE",
  "registered_at": "2026-09-15T04:12:33.488Z",
  "manifest": { },
  "manifest_digest": { "alg": "sha-256", "value": "..." },
  "proof": { },
  "proof_check": { "ok": true },
  "operator_key": {
    "key_id": "01J...",
    "document": { },
    "discovery": {
      "registry_path": "/v1/keys/01J...",
      "well_known_url": "https://operator.example/.well-known/..."
    }
  },
  "verification": { "level": "L1_REGISTERED",
                    "valid_assertions": 0, "total_assertions": 0 },
  "assertions": [],
  "verify_instructions": "..."
}
~~~
{: title="Reference implementation envelope (informative)"}

In this layout, `proof_check` and each assertion's check carry an
outcome code ({{codes}}); `registry_path` is the wire form of the key
identifier, relative to the registry's origin; assertions are
re-checked at resolution time against the current manifest; and
`verification.level` is a convenience value that a verifier recomputes
from the assertions rather than accepting ({{sec-level}}).

The protocol defines the domain-path location as
`/.well-known/agenid/keys.json`. Where an envelope's discovery pointer
differs from that location, the location defined in {{keydisc}} is the
one the protocol specifies.

# Verification Procedures {#verification}

The procedures below are those of spec Section 7, in the
specification's imperative form. Signature math is performed last, so
digest and key checks fail before any Ed25519 operation.

## ManifestProof Verification {#verify-proof}

1. Parse S; require `signature`; let P be S without `signature`.

2. Fetch the Manifest M for (`agent_id`, `manifest_version`); compute
   `sha256(JCS(M))`; require equality with `P.manifest_digest.value`.
   On mismatch: `manifest_digest_mismatch`.

3. Resolve `P.key_id` through both discovery paths ({{keydisc}});
   require that both agree; require `role == "operator"` and
   `controller == P.agent_id`. On failure: `key_role_mismatch` or
   `key_discovery_mismatch`.

4. Require key `status == "active"` at `P.created_at`; that is,
   `created_at` is earlier than `retired_at` or `revoked_at` where
   those are set.

5. Require `P.created_at <= now <= P.expires_at`.

6. Compute `Ed25519.Verify(public_key, JCS(P),
   base64url_decode(signature))`. On failure: `signature_invalid`.

7. Result: a DECLARED, operator-bound manifest. Never more than
   DECLARED.

## VerificationAssertion Verification {#verify-assertion}

The specification states: "Steps 1, 4, 5, 6 as above, plus" the
following primed steps. It lists step 5 among the steps carried over
and also gives step 5', which states the window for assertions; this
document reads step 5' as the assertion form of step 5. Step 3' states
the role and controller requirements for authority keys; the
specification does not restate whether the two-path agreement
requirement of step 3 applies to authority keys, although it defines
an authority discovery path ({{keydisc}}).

Step 2':
: Compute `sha256(JCS(M))` for the manifest version being evaluated;
  require equality with `P.manifest_digest.value`. An assertion whose
  digest matches an older manifest version is valid for that version
  and not applicable to the current one; report
  `assertion_not_applicable_to_current_manifest`, not invalid.

Step 3':
: Require `role == "authority"` and `controller == P.authority`. In
  addition, the verifier MUST decide whether it trusts `P.authority`
  at all ({{trust-anchors}}). A valid signature from an untrusted
  Authority is `authority_untrusted`, not VERIFIED.

Step 5':
: The window is `verified_at <= now <= expires_at`.

Result: VERIFIED for exactly `claim`, at `level`, within `scope`.
Nothing outside `scope` is implied.

Step 4 as written refers to `P.created_at`. A VerificationAssertion has
no `created_at` member. The specification does not state which member
takes its place; `verified_at` is the member that dates the signature,
but the text does not say so.

## Role Enforcement

For both procedures, signature validity is necessary and not
sufficient. A verifier MUST reject a ManifestProof signed by an
`authority`-role key, and MUST reject a VerificationAssertion signed by
an `operator`-role key, even if the Ed25519 verification succeeds. A
signature that validates under a key of the wrong role MUST be
rejected, and implementations MUST check `role` in addition to the
signature, because a party that held both an operator key and an
authority key could otherwise verify its own claims.

## Clock Tolerance

The windows in steps 5 and 5' are stated without leeway. The
specification does not define a clock-skew allowance for verification
or for registration.

# Error and Outcome Codes {#codes}

## Codes Defined by the Specification

| Code | Where it arises |
|---|---|
| `manifest_digest_mismatch` | ManifestProof step 2 |
| `key_role_mismatch` | ManifestProof step 3; assertion step 3' |
| `key_discovery_mismatch` | Step 3 (the two discovery paths disagree) |
| `signature_invalid` | Step 6 |
| `assertion_not_applicable_to_current_manifest` | Assertion step 2' (digest matches another manifest version) |
| `authority_untrusted` | Assertion step 3' (valid signature, untrusted Authority) |
| `trust_anchor_mismatch` | Pinned root and online path disagree ({{trust-anchors}}); hard failure |
| `invalid_number_domain` | Validation ({{number-domain}}) |
| `invalid_key_id` | HTTP 400 for a `key_id` containing `#` ({{logical-wire}}) |
{: title="Codes defined in spec Sections 5, 7, 9"}

The specification does not name codes for the failures in steps 4
(key not active at signing time) and 5 (outside the validity window),
for a controller mismatch reported separately from a role mismatch, or
for schema-invalid input. It does not define an error body format.

## Reference Implementation Codes (Informative)

The reference implementation ({{impl-status}}) reports verification
outcomes as values, not exceptions. A successful result carries a
claim state of `DECLARED` or `VERIFIED`. Its documented failure codes
are `schema_invalid`, `manifest_digest_mismatch`,
`assertion_not_applicable_to_current_manifest`, `key_id_mismatch`,
`key_role_mismatch`, `key_controller_mismatch`,
`key_not_active_at_signing_time`, `not_yet_valid`, `expired`, and
`signature_invalid`. It uses a separate set of codes for malformed
input and signing-time misuse, including `invalid_number_domain` and
`invalid_key_id`, and a third set for HTTP route errors (for example
`agent_not_found`, `agent_exists`, `key_conflict`, `key_not_found`,
`registry_unavailable`, `rate_limited`).

The reference implementation's documented outcome list does not include
`key_discovery_mismatch`, `authority_untrusted` or
`trust_anchor_mismatch`. The specification does not define a mapping
between its codes and implementation-specific ones.

# Security Considerations {#security}

This section draws on the specification's security model (spec Section
16) and on the threat analysis maintained with the reference
implementation. It describes properties and limits; it does not add
protocol requirements.

## What a Successful Verification Establishes

A successful ManifestProof verification establishes that the holder of
a specific operator key signed a specific manifest digest for a
specific Agent identifier within a stated window. A successful
VerificationAssertion verification establishes that a named Authority,
whose key the verifier trusts, asserted a specific claim about a
specific manifest version within a stated scope and window. Neither
establishes that the signed statements are true, that the agent
behaves as declared, or that any party is authorized to act. The
protocol provides no confidentiality and no non-repudiation beyond the
custody of the signing key.

Operator attestations (`disclosure.*`) cannot be checked by anyone. The
protocol can show only that they were stated under a real key.
Implementations that build manifests on an operator's behalf and
supply default values for these members produce signed claims that the
operator did not make.

## Registry Compromise {#sec-registry}

A compromised Registry, or an attacker holding its database
credentials, cannot forge an Operator's or Authority's signature. A
fabricated registration or altered manifest fails verification in
every verifier's own re-check (digest binding and signature).

A compromised Registry can:

* suppress or delete records, making an identity unresolvable;

* report a level no valid assertion supports ({{sec-level}});

* substitute a key document it controls for an Operator's, and then
  present objects signed with that key.

Two-path key discovery is the defense against key substitution: the
Operator's own domain publishes the keys it vouches for. That defense
is in force only for Agents whose Operator publishes a Keys Document at
the well-known location. Where the Operator publishes none, a verifier
has a single source. The specification does not state the outcome of
the agreement check in that case ({{keydisc}}); a verifier that treats
a missing operator copy as agreement has disabled the defense.

## Level Reported by a Registry {#sec-level}

A level reported by a Registry or resolver is a convenience. A verifier
that accepts it without recomputing it from assertions that pass
{{verification}} is not protected against a Registry that misreports
it. Every assertion carries its own signature so that the level can be
recomputed.

## Root Authority Key Compromise and the Absence of Delegation

v1.1.1 defines no delegation or cross-signing object. Nothing binds an
Authority key other than a pinned root key to that root. In practice
this means the pinned root key signs every assertion that verifiers
are expected to accept, and the pattern of an offline root key
certifying online intermediate keys is unavailable.

If the root authority key is compromised, the impact is retroactive: a
verifier cannot distinguish a legitimate historical assertion from a
backdated forgery, so every assertion ever issued under that root
becomes suspect. Key rotation does not repair this, because the pin is
the anchor. The specification's maintainers have described a
delegation object as work for a later protocol version.

## Distribution of the Root Pin

The pin is distributed out of band through the specification's
repository, and the online path relies on TLS and DNS for
`agenid.com`. An attacker who controls the repository's hosting
organization, the DNS zone, or the certificate issuance for that
domain can publish a different pin without using any of the root key's
material. Hardware protection of the private key does not mitigate
this. Account security for the repository organization, registrar
lock, DNSSEC, and signed commits on the specification repository bear
directly on the strength of the trust anchor. The requirement that
verifiers pin the root, and treat disagreement as
`trust_anchor_mismatch`, exists so that compromise of only the online
path is detectable.

## Authority Trust and Scope

A valid signature from an Authority the verifier does not trust is
`authority_untrusted`, not VERIFIED. A VERIFIED result is limited to
the assertion's `scope`. The specification requires `scope` to be one
of the Authority's published scope identifiers but does not define
where they are published, so a verifier has no protocol-defined way to
check that requirement.

## Role and Controller Confusion

Separate signed objects for DECLARED and VERIFIED content, together
with key-role enforcement at verification time, prevent an operator key
from producing VERIFIED content and an authority key from producing
DECLARED content. The role check is required even where the math would
fail anyway, so that a party holding keys of both roles cannot
self-verify.

## Canonicalization Divergence

If two implementations disagree about the canonical bytes of an
object, a signature is valid to one and invalid to the other. The
specification addresses this with JCS, published adversarial vectors
(numbers, Unicode, member ordering, empty values and null), and the
number-domain rule of Erratum E1, which rejects integer-literal tokens
that do not round-trip through common JSON parsers.

Some key-management services offer both PureEdDSA and a pre-hashed
Ed25519 variant under one key. Signing a SHA-256 or SHA-512 pre-hash of
the canonical bytes produces signatures that do not verify under this
protocol, and the error is not visible at signing time. Implementers
that use external signing services need to confirm that the service
performs PureEdDSA over the exact `signing_input` bytes.

## Manifest Tampering and Stale Assertions

Any change to a Manifest changes its digest, so a tampered manifest
fails at step 2 before any signature operation. Every assertion
carries the digest of the manifest version it was issued against, so
an assertion obtained for one manifest cannot be presented as
endorsing an edited one; it is reported as
`assertion_not_applicable_to_current_manifest`.

## Replay and Expiry

Signatures in this protocol authenticate objects, not requests. Any
party holding a copy of a ManifestProof or VerificationAssertion can
present it again for as long as its validity window lasts. The
windows (`created_at`/`expires_at` and `verified_at`/`expires_at`) are
checked independently of key status. Registration replay is addressed
by the uniqueness check required before commit; the reference
implementation answers a resubmitted registration with a conflict
rather than an overwrite.

## Clock Skew

Validity windows are compared against the verifier's clock. The
specification defines no leeway. A verifier with a skewed clock may
accept an expired object or reject a current one. The reference
implementation applies no leeway at verification, tolerates up to 120
seconds of forward client clock skew at registration only, and records
the registration time from the Registry's own clock.

## No Request Binding

v1.1.1 does not bind a live interaction (a call, a message, an HTTP
request) to an Agent identifier. It specifies no challenge-response
exchange, no session binding, and no proof of possession of the
operator key at interaction time. A party presenting an Agent
identifier, or an envelope, is not thereby shown to be the Agent or its
Operator. Mechanisms such as HTTP Message Signatures {{RFC9421}} could
carry such a binding, but the specification defines no profile for
them, and this document does not.

## Revocation

The specification defines key `retired` and `revoked` states with
timestamps, and Agent and Deployment `REVOKED` status. It defines no
revocation object for a VerificationAssertion; an assertion stops
applying when it expires or when the manifest changes. Because key
status is read from key documents, a verifier that caches key
documents may act on a revocation late.

In the reference deployment described in {{impl-status}}, no path
writes Agent status or revokes a key: every Agent is `ACTIVE`, and
there is no operational revocation flow. A relying party therefore
cannot learn of a compromised operator key through this deployment.

## Operator Key Custody

If an operator private key leaks, the holder is that Operator for
every purpose of this protocol, and nothing downstream detects it
until the key is revoked. The protocol assumes Operators generate and
hold their own keys; a Registry that generates or holds operator keys
could sign on an Operator's behalf, which would make its assertions
meaningless.

## Evidence Content

`evidence.reference` is a pointer, not content. This keeps private
evidence (documents, business records) out of public material. It also
means that evidence for L3 (document review) cannot be re-derived by a
third party, whereas evidence for L2 (a DNS TXT record) can be checked
by anyone who queries DNS.

## Denial of Service

Registration in the reference deployment is unauthenticated, because
the operator signature authenticates the object. Every registration is
signature-verified and self-attributed, so an attacker gains no
identity it does not control, but storage and processing can still be
consumed. The reference deployment applies per-client rate limits to
its write endpoints.

## Presentation

User interfaces that render verification results are part of the
security boundary. Rendering a DECLARED or registration-only result in
a style reserved for third-party verification presents a
self-declaration as verified. Conversely, rendering "not registered"
or "not verified" as a warning treats absence of participation as a
negative finding, which the protocol does not support. These are
implementation concerns; the specification does not define
presentation.

## Adapters

Adapter output is DECLARED-equivalent only (spec Section 18). A
platform configuration mapped into protocol objects by an adapter does
not become VERIFIED by that mapping.

# Privacy Considerations

Public material: the Manifest, the ManifestProof, VerificationAssertions
(with evidence references), key documents, and status. Never public:
evidence content, secrets, and prohibited content (spec Section 17).

The Manifest carries an operator name, an operator domain, and a
contact address. These are published by design. Operators should
expect them to be collected by anyone who resolves the identifier.

The event ledger holds hashes and references only, and
`assertion.issued` events carry the assertion identifier and manifest
digest, never evidence.

Resolution requests reveal to the resolver which identifiers a party
is checking, and domain-path key discovery reveals the same to the
Operator's web server. The specification does not address verifier
privacy. Verification itself can run offline once the envelope and key
documents are held, which limits what later checks disclose.

Agent identifiers are non-semantic ULIDs, but a ULID encodes its
creation time in its leading characters, so an identifier discloses
approximately when it was minted.

# IANA Considerations

## Well-Known URI Registration

This document requests registration of the following entry in the
"Well-Known URIs" registry established by {{RFC8615}}. The request is
presented as a template for discussion; this draft has not been
submitted, and no registration has been made.

URI suffix:
: agenid

Change controller:
: AI Venture Holdings LLC

Specification document(s):
: This document ({{keydisc}} and {{trust-anchors}}), and {{AGENID-SPEC}}

Status:
: provisional

Related information:
: The protocol uses two resources beneath this suffix:
  `/.well-known/agenid/keys.json` (a Keys Document, served by any
  Operator or Authority domain) and `/.well-known/agenid/authorities.json`
  (the Authorities Document, served at `agenid.com`).

## Media Types

The specification defines no media types. Protocol documents are
served as `application/json`. This document makes no media type
registration request.

## URI Schemes

Identifiers in this protocol take the forms `agenid:...` and
`assertion:...`. The specification does not register URI schemes for
these prefixes and does not state whether they are intended as URIs.
This document makes no URI scheme registration request; this is noted
as an open issue.

# Implementation Status {#impl-status}

Note to RFC Editor: please remove this section before publication.

This section records the status of known implementations of the
protocol defined by this specification at the time of posting of this
Internet-Draft, and is based on a proposal described in {{RFC7942}}.
The description of implementations in this section is intended to
assist the IETF in its decision processes in progressing drafts to
RFCs. Please note that the listing of any individual implementation
here does not imply endorsement by the IETF. Furthermore, no effort
has been spent to verify the information presented here that was
supplied by IETF contributors. This is not intended as, and must not be
construed to be, a catalog of available implementations or their
features. Readers are advised to note that other implementations may
exist.

According to RFC 7942, "this will allow reviewers and working groups
to assign due consideration to documents that have the benefit of
running code, which may serve as evidence of valuable experimentation
and feedback that have made the implemented protocols more mature. It
is up to the individual working groups to use this information as they
see fit".

## Reference Implementation

Organization:
: AI Venture Holdings LLC

Description:
: A TypeScript implementation comprising a core library (identifiers,
  RFC 8785 canonicalization, strict schemas, the ManifestProof and
  VerificationAssertion verification procedures, and the spec Section 8
  vectors), an independently written browser-side signer held
  byte-identical to the core library by a cross-implementation test, a
  registry served by a web application, a standalone registry server,
  and a command-line signer. Erratum E1 was found by this
  implementation. The source repository is not referenced here; the
  public artifacts are {{AGENID-SPEC}} and {{AGENID-CONFORMANCE}}.

Maturity:
: Deployed at L1. Verification procedures and registration are
  implemented and tested; the trust root does not exist.

Coverage:
: Canonicalization, number domain, signing construction, ManifestProof
  verification, VerificationAssertion verification, key role and
  controller enforcement, key lifecycle evaluation at signing time,
  the registry key resolver with logical and wire forms, and the
  resolution envelope. The assertion write path exists in the
  standalone registry server and is not deployed.

Contact:
: M. Morgan, mike@mmivip.com

## Conformance Suite

{{AGENID-CONFORMANCE}} is a conformance suite for the spec Section 8
vectors, including the adversarial canonicalization vectors and the
number-domain rejections. It is maintained so that it does not depend
on the reference implementation's core library.

## Deployment at www.agenid.com

A registry based on the reference implementation is deployed at
`https://www.agenid.com`, backed by a durable database. As of the date
of this draft:

* It reports DECLARED and `L1_REGISTERED` only. Nothing at L2 or above
  can be issued, because L2 and higher require a VerificationAssertion
  signed under the root authority key, and the root authority key has
  not been created. `/.well-known/agenid/authorities.json`
  returns 404, and no pin has been published.

* It reports `L1_REGISTERED` for an accepted registration without an
  authority-signed VerificationAssertion (the envelope reports zero
  assertions). The specification states that each level, including L1,
  is issued only as a VerificationAssertion. A verifier can therefore
  re-derive DECLARED from signed material, but the deployment's L1
  rests on the registry's own record rather than on a signed object.
  This is a divergence between the deployment and the specification.

* It serves the registry key resolver at `/v1/keys/{key-ULID}` and
  `/v1/keys?key_id=...` from `https://www.agenid.com`, not from the
  hostname written in spec Section 9.2. Its registration and
  resolution endpoints are served at paths that differ from those in
  spec Section 14; the reference documentation does not list the
  `/v1/agents/{agent_id}/proof`, `/v1/agents/{agent_id}/assertions` or
  `/v1/assertions/{assertion-ULID}` resources as deployed.

* Its envelope names both key discovery paths. The domain-path check
  is effective only for Operators who publish a Keys Document.

* Agent status is always `ACTIVE`; there is no path that writes another
  status and no key revocation flow.

* Registration is unauthenticated and rate limited.

Custody of the future root authority key has been decided by the
implementer (a cloud HSM-backed key-management service that offers
Ed25519 in PureEdDSA mode only), with automatic rotation disabled
because rotation would orphan the published pin. The key ceremony has
not taken place.

# Acknowledgments
{:numbered="false"}

Erratum E1 was identified while building the TypeScript reference
implementation, when the original integer-based wording of the
number-domain rule proved impossible to implement in a language that
does not distinguish integer and floating-point literals.

--- back

# Test Vectors {#vectors}

These vectors are from spec Section 8. They use test keys only. Seeds
are `SHA-256(label)` of the ASCII labels shown, so every value can be
regenerated. Long lines are folded using the single-backslash strategy
of {{RFC8792}}; unfold before use.

## Keys

~~~
Operator key
  seed label:  AgenID v1.1.1 operator test key seed
  key_id:      agenid:key:01J8Z3M9Q4XK2P7VBN6TDR8HWE
  role:        operator
  controller:  agenid:01J8Z3K3F2QZ9X6V7R4T8N2W5Y
  public key:  C2XCaQ41IZoFum-4PbNJ1aUCevSZwClSzjyZ-x85T3g (base64url)

Authority key
  seed label:  AgenID v1.1.1 authority test key seed
  key_id:      agenid:key:01J8Z3NC5R7YT3W9KM2XQ4VJHB
  role:        authority
  controller:  agenid:authority:node-01
  public key:  gGsTCSTbswlr2XSubZnRSyGM9X4pH_piNzVTZ0rmT-A (base64url)
~~~

Private keys (32 bytes, hex):

~~~
operator:  eb775bd120e9b13accc73ce6c869f88c
           2e03beb327be2c2582be031a27297c0d
authority: 68ab5520f6de62c073760132437f8b6f
           3e841ad69bc742f18795d235c022b21b
~~~

Public keys (32 bytes, hex):

~~~
operator:  0b65c2690e35219a05ba6fb83db349d5
           a5027af499c02952ce3c99fb1f394f78
authority: 806b130924dbb3096bd974ae6d99d14b
           218cf57e291ffa62373553674ae64fe0
~~~

## Manifest and Digest

The manifest of spec Section 8.2, canonicalized with JCS:

~~~
=============== NOTE: '\' line wrapping per RFC 8792 ================

{"agent_id":"agenid:01J8Z3K3F2QZ9X6V7R4T8N2W5Y","disclosure":{"discl\
oses_to_user":true,"human_escalation":true,"is_ai":true},"identity":\
{"description":"Inbound appointment scheduling assistant","name":"Sa\
rah"},"manifest_version":"1.0","ownership":{"contact":"trust@acmemed\
ical.com","operator":"Acme Medical LLC","operator_domain":"acmemedic\
al.com"},"purpose":{"channels":["voice","sms"],"summary":"Schedule\
s and reschedules patient appointments by phone and SMS"}}
~~~

~~~
manifest_digest (sha-256) =
  81ba268016595373a12091598403eb1d099b214faed04fdabb5bdb47b473ab5d
~~~

## ManifestProof Vector {#vector-proof}

`signing_input` (the exact bytes passed to Ed25519):

~~~
=============== NOTE: '\' line wrapping per RFC 8792 ================

{"$schema":"https://agenid.com/schemas/v1.1.1/manifest-proof.json","\
agent_id":"agenid:01J8Z3K3F2QZ9X6V7R4T8N2W5Y","created_at":"2026-09-\
13T00:00:00Z","expires_at":"2026-12-12T00:00:00Z","key_id":"agenid:k\
ey:01J8Z3M9Q4XK2P7VBN6TDR8HWE","manifest_digest":{"alg":"sha-256","v\
alue":"81ba268016595373a12091598403eb1d099b214faed04fdabb5bdb47b473a\
b5d"},"manifest_version":"1.0","proof_type":"manifest_self_declarati\
on"}
~~~

Signature (Ed25519, operator key), hex, then base64url:

~~~
82d5eddc2237e716621efd7a62c296589bae67c4d74de5d3cd6a2743b6eb699e
cfdda0b8449271258d221886b1f3a48bc9b469de7c653f8163d169a4497ba405

gtXt3CI35xZiHv16YsKWWJuuZ8TXTeXTzWonQ7braZ7
P3aC4RJJxJY0iGIax86SLybRp3nxlP4Fj0WmkSXukBQ
~~~

(Each value is shown on two lines; concatenate without a separator.)

## VerificationAssertion Vector {#vector-assertion}

`signing_input`:

~~~
=============== NOTE: '\' line wrapping per RFC 8792 ================

{"$schema":"https://agenid.com/schemas/v1.1.1/assertion.json","asser\
tion_id":"assertion:01J8Z3P2K8VW4RN7XTQ6MYD5HC","authority":"agenid:\
authority:node-01","claim":{"domain":"acmemedical.com","type":"domai\
n_control"},"evidence":{"reference":"_agenid-challenge.acmemedical.c\
om","type":"dns_txt_challenge"},"expires_at":"2026-10-13T06:00:00Z",\
"key_id":"agenid:key:01J8Z3NC5R7YT3W9KM2XQ4VJHB","level":"L2_DOMAIN_\
VERIFIED","manifest_digest":{"alg":"sha-256","value":"81ba2680165953\
73a12091598403eb1d099b214faed04fdabb5bdb47b473ab5d"},"scope":"domain\
_control_only","subject":"agenid:01J8Z3K3F2QZ9X6V7R4T8N2W5Y","subjec\
t_type":"agent","verified_at":"2026-09-13T06:00:00Z"}
~~~

Signature (Ed25519, authority key), hex, then base64url:

~~~
fa3ed4aac8de0200be8e31b1e56d0a6783c6c4c1e298bf297b25522aa1b8f369
c0f64809c9c5c82777ffa9dd25d724a1078b8e179aff8a55af6d33e73fd6530b

-j7UqsjeAgC-jjGx5W0KZ4PGxMHimL8peyVSKqG482n
A9kgJycXIJ3f_qd0l1yShB4uOF5r_ilWvbTPnP9ZTCw
~~~

## Note on the Signature Values

The signature values above were recomputed by the author of this
document from the seed labels and the signing inputs printed in spec
Sections 8.3 and 8.4, and verify over those inputs. At the time of
writing, the prose copy of the specification prints signature values
for Sections 8.3 and 8.4 that do not verify over its own printed
signing inputs; they verify over the signing inputs as they were before
Erratum E2 changed the `$schema` URI. The digest, keys and signing
inputs agree. The machine-readable vector file published with the
specification is the reference for implementers. The printed values
in the prose specification should be corrected.

## Negative Cases

Spec Section 8.6 records these results:

| Case | Result |
|---|---|
| Assertion `level` changed to `L3_ORGANIZATION_VERIFIED`, original signature | Rejected |
| Assertion signature checked under the operator public key | Rejected |
| ManifestProof signature checked under the authority public key | Rejected |
| Manifest `disclosure.human_escalation` set to `false` | Digest mismatch, before any signature operation |
| `signature` member included in the signing input | Rejected |
| Manifest members supplied in a different order | Identical canonical bytes |
{: title="Negative and invariance cases (spec Section 8.6)"}

The adversarial canonicalization vectors (numbers, Unicode, member
ordering, empty values and null) and the number-domain rejection
inputs are in spec Section 8.7. The Unicode vector contains characters
that do not survive rendering; use the hexadecimal form given there.
