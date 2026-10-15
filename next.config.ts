import type { NextConfig } from "next";

const supabaseHostname = (() => {
  try {
    return process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname : "";
  } catch {
    return "";
  }
})();

const nextConfig: NextConfig = {
  images: {
    imageSizes: [32, 48, 64, 96, 128, 256, 320, 384, 480],
    qualities: [65, 75],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      ...(supabaseHostname ? [{
        protocol: "https" as const,
        hostname: supabaseHostname,
        port: "",
        pathname: "/storage/v1/object/public/place-images/**",
        search: "",
      }] : []),
    ],
  },
};

export default nextConfig;
