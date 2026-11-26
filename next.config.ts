import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "25mb",
    },
  },
  // Keep PDF/native-ish packages outside the webpack bundle so fonts & assets resolve
  serverExternalPackages: [
    "pdfjs-dist",
    "pdf-parse",
    "pdf-lib",
    "@react-pdf/renderer",
    "@react-pdf/pdfkit",
    "pdfkit",
    "fontkit",
    "sharp",
  ],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" },
    ],
  },
};

export default nextConfig;
