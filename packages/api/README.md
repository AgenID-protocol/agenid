# @agenid/api — Registry REST API

Fastify 5. Implements spec §13 (endpoints), §9.2 (key resolution), §14 (envelope) over a storage-independent `RegistryStore` (`MemoryStore` included; a durable store plugs in behind the same interface).

| Method | Path | Notes |
|---|---|---|
| `POST` | `/v1/agents` | `{ manifest, proof, key_document }` — strict schema, digest binding, operator role/controller, Ed25519 verified, agent_id uniqueness. 201 → `agent_id`, L1 |
| `GET` | `/v1/agents/:agent_id` | Resolution envelope: manifest, proof + check, assertions + checks, highest valid level, key-discovery pointers |
| `GET` | `/v1/agents/:agent_id/proof` | Current `ManifestProof` |
| `GET` | `/v1/agents/:agent_id/assertions` | All assertions (valid and expired), each with its §7.2 check result |
| `GET` | `/v1/agents/:agent_id/events` | Append-only ledger (hashes/references only) |
| `POST` | `/v1/agents/:agent_id/assertions` | **Authority bearer token.** Assertion is verified against the authority key already published here |
| `GET` | `/v1/assertions/:assertion_ulid` | One assertion by bare ULID |
| `GET` | `/v1/keys/:key_ulid` · `/v1/keys?key_id=` | Key document. Both forms identical; any `#` → `400 invalid_key_id` |
| `POST` | `/v1/keys` | **Authority bearer token.** Publish an authority key document |

```bash
pnpm build && pnpm test          # 15 integration tests, real keys and signatures
AGENID_AUTHORITY_TOKEN=… pnpm start
```

Not in this phase: durable storage, `PATCH` manifest (→ `CHANGED`), status transitions, L2 challenge automation, rate limiting.
