import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [{ hostname: "www.gravatar.com" }],
  },
};

export default nextConfig;
