import type { NextConfig } from "next";

const defaultCsp =
  "default-src 'self' 'unsafe-inline' 'unsafe-eval' https: wss: data: blob:;";

function buildFrameAncestors(): string {
  const raw = process.env.OSIRIS_FRAME_ANCESTORS?.trim();
  if (!raw) return "'self'";
  return raw.split(/[\s,]+/).map((t) => t.trim()).filter(Boolean).join(" ");
}

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["ws"],
  transpilePackages: ["react-map-gl", "mapbox-gl", "maplibre-gl"],
  typescript: { ignoreBuildErrors: true },
  images: { remotePatterns: [{ protocol: "https", hostname: "**" }] },
  async headers() {
    const frameAncestors = buildFrameAncestors();
    return [{
      source: "/(.*)",
      headers: [
        { key: "Content-Security-Policy", value: `${defaultCsp} frame-ancestors ${frameAncestors};` },
        { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-XSS-Protection", value: "1; mode=block" },
      ],
    }];
  },
};

export default nextConfig;
