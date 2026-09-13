import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
