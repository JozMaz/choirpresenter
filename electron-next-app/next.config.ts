import type { NextConfig } from "next";

const isProduction = process.env.NODE_ENV === "production";

const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
  trailingSlash: false,
  assetPrefix: isProduction ? "./" : undefined,
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
