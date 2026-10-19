# Needs Mike

Each item is outside the autonomy mandate's hard limits (spending, external communication, irreversible or security-sensitive commitments, account creation). Each has a recommendation ready to approve. Nothing else in the plan waits on these.

| # | Decision | Why it is yours | Recommendation | To approve |
|---|---|---|---|---|
| 1 | **Approve the root authority key policy and start the hardening checklist** | Creates the trust root every level above L1 depends on; permanent once issued | Approve the drafted policy as written (Google Cloud KMS, `EC_SIGN_ED25519`, HSM protection, `authority_id` = `agenid:authority:agenid`). The first step is the hardening checklist, not key creation. | Reply "approve root key policy". The policy is in the private project record (`agenid-root-key-policy.md`). |
| 2 | **Create the `agenid` npm organization** | Account creation on a third-party service, and publishing is a make-public act | Create the free org, then let the session publish `@agenid/core` 1.1.1 only (already approved 2026-09-23). | https://www.npmjs.com/org/create — name `agenid`, free plan. |
| 3 | **Create an IETF Datatracker account** | Account creation; the draft submits under your name | Create it with mike@mmivip.com; the session submits `draft-morgan-agenid-agent-identity-00` and you click one confirmation email. | https://datatracker.ietf.org/accounts/create/ |
| 4 | **Submit the Domain Connect service template upstream** | A public pull request on the company's behalf to a third-party registry | Approve; the session opens the PR to `Domain-Connect/Templates` with the template already live at `/domain-connect/agent-identity.json`. Nothing changes on the site until a provider accepts it. | Reply "submit domain connect template". |
| 5 | **Verify agenid.com in Google Search Console and Bing Webmaster Tools** | Account-level ownership verification | Add the property with the DNS TXT method, add the one record each service shows you at Cloudflare, then submit `https://www.agenid.com/sitemap.xml`. | https://search.google.com/search-console · https://www.bing.com/webmasters |
| 6 | **Directory moderation policy** | A product/legal call about delisting operator content | Keep self-service listing; add a "report this listing" link and an AIVH delist path that writes a ledger event and never alters the operator's signed consent. | Reply "approve directory moderation". |
| 7 | **Commercial direction for financial capability** | Business model and legal engagement | Recorded in the private project record (queue #42). No engineering this week depends on it. | Read the spike when convenient. |

_Added during the week as new items arise. Items resolved by Mike move to LOG.md with the date._
