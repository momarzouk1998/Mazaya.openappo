import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  experimental: {
    serverActions: { bodySizeLimit: "10mb" },
    staleTimes: {
      dynamic: 60,
      static: 300,
    },
  },
  // Optimize bundle size
  swcMinify: true,
  // Reduce bundle size by optimizing imports
  modularizeImports: {
    'recharts': {
      transform: 'recharts/{{member}}',
    },
  },
  // Compress responses
  compress: true,
  async headers() {
    return [
      // Security headers — protect against clickjacking, MIME sniffing, etc.
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-DNS-Prefetch-Control", value: "on" },
        ],
      },
      // Service Worker — must revalidate on every request
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "public, max-age=0, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
      // Static assets caching
      {
        source: "/(.*)\\.(?:js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
    ];
  },
};

export default nextConfig;
