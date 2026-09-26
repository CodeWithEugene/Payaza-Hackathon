import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Native/WASM server packages must not be bundled (PGlite WASM, postgres-js).
  serverExternalPackages: ["@electric-sql/pglite", "postgres"],
  experimental: {
    // Snap-step photo uploads (OCR path) can exceed the 1MB default.
    serverActions: { bodySizeLimit: "6mb" },
  },
  async headers() {
    // Security checklist §12: CSP + frame protection. Payaza hosted checkout
    // domains allowlisted in connect-src/frame-src/script-src.
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://checkout-v2.payaza.africa https://checkout.payaza.africa https://cdn.jsdelivr.net",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "connect-src 'self' https://api.payaza.africa https://checkout-v2.payaza.africa https://checkout.payaza.africa https://business.payaza.africa",
      "frame-src https://checkout-v2.payaza.africa https://checkout.payaza.africa https://business.payaza.africa",
      "frame-ancestors 'none'",
      "worker-src 'self' blob:",
      "object-src 'none'",
      "base-uri 'self'",
    ].join("; ");
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
