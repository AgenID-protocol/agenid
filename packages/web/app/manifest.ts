import type { MetadataRoute } from "next";
import { HOME_DESCRIPTION } from "@/lib/seo";

/**
 * Web app manifest. Colors are the Brand Guide v1.0 Ink (#0B0F17) — never Verified
 * Emerald, which is reserved for verified state and must not become chrome.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "AgenID — Verifiable Identity for AI Agents",
    short_name: "AgenID",
    description: HOME_DESCRIPTION,
    start_url: "/",
    display: "browser",
    background_color: "#0B0F17",
    theme_color: "#0B0F17",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/agenid-mark.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
