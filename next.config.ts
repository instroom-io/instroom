import type { NextConfig } from "next";

// The influencer API host, read once at build time.
//
// `env` below requires a string, so an unset variable still has to become "" —
// but it must not do so SILENTLY. That was the whole failure mode on Preview and
// Production: `.env` is gitignored (`.env*`), so a deployment gets this only
// from the Vercel project settings, and when it is missing there the build
// happily inlines "" and ships. Nothing fails at build; the app just tells every
// user "Influencer API unavailable" at runtime, which points at the API instead
// of at the missing variable.
//
// So the build says so out loud. A warning rather than a thrown error on
// purpose: influencer lookup is one feature, and failing the build would stop
// Pipeline, Post Tracker and everything else from deploying over it.
const instroomApiBaseUrl = process.env.INSTROOM_API_BASE_URL ?? "";

if (!instroomApiBaseUrl.trim()) {
  console.warn(`
[next.config] INSTROOM_API_BASE_URL is not set for this build.
  Influencer lookup (Influencer List, Discovery, Discovery Search) will be
  disabled. The value is inlined into the client bundle at build time, so
  setting it after deploying has no effect without a redeploy.
  On Vercel: Project Settings -> Environment Variables, for Production AND
  Preview, then redeploy.
`);
}

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
  // so never add a secret here. Marking it "Secret" in a hosting dashboard does
  // not change that; the value still reaches the browser.
  env: {
    INSTROOM_API_BASE_URL: instroomApiBaseUrl,
  },
};

export default nextConfig;
