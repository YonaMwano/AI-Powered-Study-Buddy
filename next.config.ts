import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "25mb",
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.supabase.co",
      },
      {
        protocol: "https",
        hostname: "api.kie.ai",
      },
    ],
  },
  serverExternalPackages: [
    "pdf-parse",
    "pdfjs-dist",
    "sharp",
    "mammoth",
    "canvas",
  ],
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = config.externals || [];
      if (Array.isArray(config.externals)) {
        config.externals.push("canvas");
      }
    } else {
      config.resolve = config.resolve || {};
      config.resolve.fallback = {
        ...(config.resolve.fallback || {}),
        canvas: false,
        fs: false,
      };
    }
    return config;
  },
};

export default nextConfig;
