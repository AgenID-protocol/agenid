/**
 * Domain Connect — the one-click DNS provisioning path.
 *
 * WHY THIS AND NOT A CLOUDFLARE API TOKEN
 * ---------------------------------------
 * There are two ways to put a `_agenid` TXT record into an operator's zone without
 * making them type it:
 *
 *   (a) AgenID holds a Cloudflare/GoDaddy API credential and writes the record itself.
 *       That is what `app/api/dns/auto-add/route.ts` used to implement; it has since
 *       been DELETED rather than left unconfigured, because a credential-holding write
 *       path sitting in the tree invites a future session to "finish" it. It means
 *       AgenID holds write access to *customers'* DNS zones — the highest-blast-radius
 *       credential a company can hold, on a product whose entire value is that it does
 *       not ask you to trust it.
 *
 *   (b) Domain Connect: the operator is sent to their OWN DNS provider, already signed
 *       in, sees the exact records that will be written, and authorizes them there.
 *       AgenID never holds a credential, never sees the session, and cannot write
 *       anything the operator did not approve on their provider's own screen.
 *
 * (b) is the correct answer for this product specifically. A trust-infrastructure
 * vendor asking for zone-edit access across its customer base is the thing the product
 * exists to argue against.
 *
 * WHAT IS AND IS NOT DEPLOYED
 * ---------------------------
 * The discovery half of Domain Connect is real and works today: any provider that
 * supports it publishes `_domainconnect.<domain>` and serves a settings document. The
 * apply half requires AgenID's service template to be registered with each DNS provider
 * (via the Domain-Connect/Templates repository, then picked up by Cloudflare, GoDaddy,
 * IONOS and the rest). Until that registration lands, an apply URL built here would be
 * a link to a 404 on someone else's dashboard.
 *
 * So `applyUrlFor()` returns null unless AGENID_DOMAIN_CONNECT_PROVIDER_ID is set, and
 * the UI states that the one-click path is pending template registration rather than
 * rendering a button that fails on the provider's side. A capability pill for an
 * unshipped capability is the defect this project keeps finding; this is the same
 * defect, and it is gated the same way.
 *
 * Template source of record: packages/web/public/domain-connect/agent-identity.json
 */

/** Just enough of the environment to read one flag — `process.env` satisfies it. */
export type EnvLike = Record<string, string | undefined>;

/** The service template AgenID publishes. Mirrors the JSON template byte-for-byte. */
export const DOMAIN_CONNECT_SERVICE = {
  /** Registered provider id. Must equal the `providerId` in the published template. */
  providerId: "agenid.com",
  /** Registered service id. Must equal the `serviceId` in the published template. */
  serviceId: "agent-identity",
  providerName: "AgenID",
  serviceName: "AI Agent Identity Verification",
} as const;

/** The subset of a Domain Connect settings document we actually use. */
export interface DomainConnectSettings {
  providerId?: string;
  providerName?: string;
  /** Base URL of the provider's synchronous (browser redirect) flow. */
  urlSyncUX?: string;
  urlAsyncUX?: string;
  urlAPI?: string;
  width?: number;
  height?: number;
}

export interface DomainConnectDiscovery {
  /** The provider supports Domain Connect and published a usable sync-UX base URL. */
  supported: boolean;
  /** Host from the `_domainconnect.<domain>` CNAME, if any. */
  host: string | null;
  providerName: string | null;
  urlSyncUX: string | null;
  /**
   * Why a one-click URL is not available, when it is not. Exactly one of:
   *   "no_domain_connect"   — the provider does not support Domain Connect at all
   *   "no_sync_ux"          — supports it, but published no browser-redirect endpoint
   *   "template_unregistered" — provider is ready; AgenID's template is not yet registered
   *   null                  — an apply URL was produced
   */
  reason: "no_domain_connect" | "no_sync_ux" | "template_unregistered" | null;
}

/**
 * True only when AgenID's service template has actually been registered with DNS
 * providers. Deliberately an explicit environment flag rather than an inference: there
 * is no way to detect registration from our side, and guessing would produce a button
 * that 404s on Cloudflare's dashboard — an overclaim on someone else's domain.
 */
export function templateIsRegistered(env: EnvLike = process.env): boolean {
  return env.AGENID_DOMAIN_CONNECT_PROVIDER_ID === DOMAIN_CONNECT_SERVICE.providerId;
}

/** A settings document is only usable if it offers an https sync-UX base URL. */
export function usableSyncUx(settings: DomainConnectSettings | null): string | null {
  const raw = settings?.urlSyncUX;
  if (typeof raw !== "string" || raw.length === 0) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  // A provider that hands back a non-https endpoint is not one we send an operator to.
  if (url.protocol !== "https:") return null;
  return raw.replace(/\/+$/, "");
}

/**
 * Settings-host fallbacks, for providers whose published CNAME target is not itself a
 * resolvable host.
 *
 * VERIFIED, NOT ASSUMED. GoDaddy publishes `_domainconnect.<domain>` CNAME →
 * `_domainconnect.gd.domaincontrol.com`, and the spec says to fetch
 * `https://<that host>/v2/{domain}/settings`. That host has no A record — checked with
 * `dig` against both the local resolver and 8.8.8.8 — so spec-literal discovery
 * dead-ends at the single largest Domain Connect provider. Their real settings API is
 * `domainconnect.api.godaddy.com`, confirmed by direct request:
 * `GET https://domainconnect.api.godaddy.com/v2/coolexample.com/settings` → HTTP 200,
 * `providerId: "godaddy"`.
 *
 * This map is deliberately tiny and deliberately a last resort: the CNAME target is
 * tried first, and an entry here is only consulted when that fetch produced nothing. A
 * provider that fixes its own record simply stops reaching this code.
 */
const SETTINGS_HOST_FALLBACK: Readonly<Record<string, string>> = {
  "_domainconnect.gd.domaincontrol.com": "domainconnect.api.godaddy.com",
};

/** The host to retry settings discovery against, or null when there is no known fallback. */
export function fallbackSettingsHost(cnameTarget: string): string | null {
  return SETTINGS_HOST_FALLBACK[cnameTarget.replace(/\.$/, "").toLowerCase()] ?? null;
}

/**
 * Build the provider-side apply URL.
 *
 * Shape is fixed by the Domain Connect specification:
 *   {urlSyncUX}/v2/domainTemplates/providers/{providerId}/services/{serviceId}/apply
 *     ?domain=...&<template variables>&redirect_uri=...
 *
 * Returns null when the template is not registered — see the file header.
 */
export function applyUrlFor(
  args: {
    syncUx: string;
    domain: string;
    /** The per-domain verification token. Public by design: it is published in DNS. */
    token: string;
    /** Where the provider returns the operator after they authorize. */
    redirectUri: string;
  },
  env: EnvLike = process.env,
): string | null {
  if (!templateIsRegistered(env)) return null;
  const { syncUx, domain, token, redirectUri } = args;
  if (!syncUx || !domain || !token) return null;

  const base =
    `${syncUx.replace(/\/+$/, "")}/v2/domainTemplates/providers/` +
    `${DOMAIN_CONNECT_SERVICE.providerId}/services/${DOMAIN_CONNECT_SERVICE.serviceId}/apply`;

  const url = new URL(base);
  url.searchParams.set("domain", domain);
  // Template variable — matches the `%token%` placeholder in agent-identity.json.
  url.searchParams.set("token", token);
  url.searchParams.set("redirect_uri", redirectUri);
  return url.toString();
}

/**
 * The exact record AgenID asks for. One record, not three — stating a requirement we do
 * not have would be padding a checklist to look more substantial than the protocol is.
 */
export function verificationRecord(domain: string, token: string) {
  return {
    type: "TXT" as const,
    name: `_agenid.${domain}`,
    value: `agenid-site-verification=${token}`,
    ttl: 300,
  };
}
