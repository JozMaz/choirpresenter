import type { NextConfig } from "next";

const isProduction = process.env.NODE_ENV === "production";

const nextConfig: NextConfig = {
  // Static HTML export → Electron načítá file://out/index.html v produkci.
  // Žádný Node server v packed app.
  output: "export",
  // Electron renderer neumí Next/Image optimization (vyžaduje server).
  images: { unoptimized: true },
  // Bez trailing slash — file URLs by jinak mířily na složku.
  trailingSlash: false,
  // Relative paths v produkci — file:// neumí absolutní cesty začínající "/".
  assetPrefix: isProduction ? "./" : undefined,
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
