import type { NextConfig } from "next";

const isElectronStaticExport = process.env.ELECTRON_STATIC_EXPORT === "true";

const nextConfig: NextConfig = {
  ...(isElectronStaticExport
    ? {
        output: "export" as const,
        assetPrefix: "./",
        trailingSlash: true,
        images: {
          unoptimized: true,
        },
      }
    : {
        images: {
          unoptimized: true,
        },
      }),
};

export default nextConfig;
