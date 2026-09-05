import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return ["/sw.js", "/pwa-assets.json"].map((source) => ({
      source,
      headers: [
        { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
      ],
    }));
  },
  experimental: {
    optimizePackageImports: ["lucide-react"],
    serverActions: {
      bodySizeLimit: "4mb",
    },
  },
  transpilePackages: [
    "@miniros/contracts",
    "@miniros/db",
    "@miniros/domain",
    "@miniros/sdk",
    "@miniros/ui",
  ],
};

export default nextConfig;
