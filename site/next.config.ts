import type { NextConfig } from "next";

const config: NextConfig = {
  // /app is the board UI: the same single page `board ui` serves, copied in at build time.
  async rewrites() {
    return [{ source: "/app", destination: "/app/index.html" }];
  },
  // lib/ is shared with the CLI's NodeNext build, so its imports carry .js specifiers.
  webpack(config) {
    config.resolve.extensionAlias = { ".js": [".ts", ".tsx", ".js"] };
    return config;
  },
  turbopack: { resolveAlias: {} },
};

export default config;
