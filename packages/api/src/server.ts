import { buildApp } from "./app.js";

const port = Number(process.env.PORT ?? 3001);
const host = process.env.HOST ?? "0.0.0.0";
const app = buildApp({ authorityToken: process.env.AGENID_AUTHORITY_TOKEN, logger: true });

app.listen({ port, host }).then((addr) => {
  app.log.info(`AgenID Registry listening on ${addr}`);
}).catch((e) => {
  app.log.error(e);
  process.exit(1);
});
