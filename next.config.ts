import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    formats: ["image/avif", "image/webp"],
    qualities: [75, 95],
  },
  // Exposes INSTROOM_API_BASE_URL to client-side code without renaming it to
  // NEXT_PUBLIC_INSTROOM_API_BASE_URL, so the host lives in ONE variable.
  //
  // The Influencer List fetches influencer profiles from the browser, and Next
  // normally strips server-side env vars out of the client bundle — only
  // NEXT_PUBLIC_-prefixed ones survive. This `env` block is the documented way to
  // inline a specific variable instead, replacing `process.env.INSTROOM_API_BASE_URL`
  // with its literal value at build time.
  //
  // Two consequences worth knowing: the value is BAKED IN at build time, so a
  // change requires restarting the dev server (or redeploying), and it is
  // embedded in JavaScript the browser downloads — fine for a public API host,
  // so never add a secret here.
  env: {
    INSTROOM_API_BASE_URL: process.env.INSTROOM_API_BASE_URL ?? "",
  },
};

export default nextConfig;
