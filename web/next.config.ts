import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Receipt and statement photos are sent to server actions; the default limit is 1 MB.
    // The actions themselves reject anything over 10 MB.
    serverActions: { bodySizeLimit: "11mb" },
  },
};

export default nextConfig;
