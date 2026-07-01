import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "4mb",
    },
  },
  transpilePackages: [
    "@miniros/contracts",
    "@miniros/domain",
    "@miniros/sdk",
    "@miniros/ui",
  ],
};

export default nextConfig;
