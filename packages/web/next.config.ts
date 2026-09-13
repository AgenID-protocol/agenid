import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    return [
      { source: "/badge.js", headers: [{ key: "Access-Control-Allow-Origin", value: "*" }, { key: "Cache-Control", value: "public, max-age=300" }] },
      { source: "/api/resolve/:path*", headers: [{ key: "Access-Control-Allow-Origin", value: "*" }] },
      {
        // Normative schema $ids (spec §6-9) resolve here. Mirrors AgenID-protocol/spec's
        // schemas/*.json verbatim — that repo remains the source of truth; these are a
        // served copy, kept in sync by hand until a CI sync step exists (queued).
        source: "/schemas/v1.1.1/:file*.json",
        headers: [
          { key: "Content-Type", value: "application/schema+json; charset=utf-8" },
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Cache-Control", value: "public, max-age=3600, stale-while-revalidate=86400" },
        ],
      },
    ];
  },
};

export default nextConfig;
