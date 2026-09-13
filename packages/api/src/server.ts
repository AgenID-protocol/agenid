import { buildApp } from "./app.js";
import { supabaseStoreFromEnv } from "./supabase-store.js";

const port = Number(process.env.PORT ?? 3001);
const host = process.env.HOST ?? "0.0.0.0";
const supabaseStore = supabaseStoreFromEnv();
const app = buildApp({
  ...(supabaseStore ? { store: supabaseStore } : {}),
  authorityToken: process.env.AGENID_AUTHORITY_TOKEN,
  logger: true,
});

app.log.info(
  supabaseStore
    ? "Registry store: Supabase (durable)"
    : "Registry store: in-memory (SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY not set — not durable across restarts)",
);

app.listen({ port, host }).then((addr) => {
  app.log.info(`AgenID Registry listening on ${addr}`);
}).catch((e) => {
  app.log.error(e);
  process.exit(1);
});
