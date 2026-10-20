import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingRoot: process.cwd(),
  serverExternalPackages: ["pdf-parse"],
  async rewrites() {
    return [{ source: "/login", destination: "/login/index.html" }];
  },
};

export default nextConfig;
