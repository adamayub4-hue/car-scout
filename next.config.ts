import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.mekivo.uk" }],
        destination: "https://mekivo.uk/:path*",
        permanent: true,
      },
      {
        source: "/:path*",
        has: [{ type: "host", value: "carscout.uk" }],
        destination: "https://mekivo.uk/:path*",
        permanent: true,
      },
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.carscout.uk" }],
        destination: "https://mekivo.uk/:path*",
        permanent: true,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
          },
        ],
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "upload.wikimedia.org",
        port: "",
        pathname: "/wikipedia/commons/thumb/**",
        search: "",
      },
      {
        protocol: "https",
        hostname: "thumb.wikimedia.org",
        port: "",
        pathname: "/wikipedia/commons/thumb/**",
        search: "",
      },
    ],
  },
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
