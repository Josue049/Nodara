import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Las pruebas E2E compilan en un directorio aparte para no pisar el de desarrollo.
  distDir: process.env.NODARA_DIST_DIR || ".next",
  devIndicators: false,
  serverExternalPackages: ["@electric-sql/pglite"],
  turbopack: {
    root: __dirname,
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
