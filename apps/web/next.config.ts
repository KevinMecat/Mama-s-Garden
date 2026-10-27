import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  output: "export",
  poweredByHeader: false,
  productionBrowserSourceMaps: process.env.BUILD_AUDIT_MAPS === "1",
  images: { unoptimized: true },
  env: { NEXT_PUBLIC_FIREBASE_EMULATORS: process.env.NEXT_PUBLIC_FIREBASE_EMULATORS === "1" ? "1" : "0" },
  ...(process.env.NODE_ENV === "production" ? {
    turbopack: { resolveAlias: { "@/lib/demo-api": "./src/lib/disabled-demo-api.ts" } },
  } : {}),
  ...(process.env.NODE_ENV === "development" ? {
    async rewrites() {
      const origin = process.env.API_INTERNAL_URL ?? "http://localhost:8000";
      return [{ source: "/api/:path*", destination: `${origin}/api/:path*` }];
    },
  } : {}),
};
export default nextConfig;
