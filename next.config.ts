import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdf-parse", "@napi-rs/canvas", "pdfkit"],
  outputFileTracingIncludes: {
    "/api/tenders/rup/extract": [
      "./node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs",
    ],
    "/api/commercial/quotations/[id]/pdf": [
      "./node_modules/pdfkit/js/data/*.afm",
      "./public/logo-itlatam.png",
    ],
  },
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
