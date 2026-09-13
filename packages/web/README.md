# @agenid/web — agenid.com

Next.js (App Router) + Tailwind. Landing page, the universal resolver, and the badge embed.

| Route | What |
|---|---|
| `/` | Landing: hero, value pillars, developer terminal, live `agenid:<ULID>` search |
| `/a/<agenid>` | **Universal resolver.** Browser → Verification Card UI. `Accept: application/json` → the canonical resolution envelope (content negotiation in `proxy.ts`) |
| `/api/resolve/<agenid>` | The envelope as JSON (what `/a/` rewrites to, and what `badge.js` calls). CORS `*` |
| `/badge.js` | Embed: `<script src="https://agenid.com/badge.js" data-agent="agenid:…"></script>` — renders the live level and links to the card |

The UI never verifies anything itself; it renders the registry's envelope, and the card tells humans how to re-verify independently. Client components never import `@agenid/core` (it uses `node:crypto`).

```bash
pnpm install
AGENID_API_URL=http://localhost:3001 pnpm dev      # needs @agenid/api running
pnpm e2e                                           # next build + scripts/e2e.mjs (in-process registry + built app)
```
