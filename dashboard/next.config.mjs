/** @type {import('next').NextConfig} */
import { join } from "path";

const nextConfig = {
  experimental: {
    // Allow importing shared code from the parent repo (we reuse the real PromptPopup).
    externalDir: true,
  },
  typescript: {
    // Skip type-checking during build (we'll rely on IDE checking and CI)
    // This avoids issues with external .tsx files that use react-native
    ignoreBuildErrors: false,
  },
  transpilePackages: [
    "react-native-web",
  ],
  webpack: (config, { isServer, dir }) => {
    // Ensure resolve.modules prioritizes dashboard's node_modules
    if (!config.resolve.modules) {
      config.resolve.modules = ["node_modules"];
    }

    // Force dashboard's node_modules to be first in resolution order
    config.resolve.modules = [
      join(dir, "node_modules"), // Absolute path to dashboard's node_modules
      ...config.resolve.modules.filter(m => !m.includes("node_modules") || m !== "node_modules"),
    ];
    
    // Prioritize .web.tsx and .web.ts extensions for React Native Web compatibility
    if (!config.resolve.extensions) {
      config.resolve.extensions = [".js", ".jsx", ".json"];
    }
    config.resolve.extensions = [
      ".web.tsx",
      ".web.ts",
      ".web.jsx",
      ".web.js",
      ...config.resolve.extensions.filter(ext => !ext.includes(".web")),
    ];

    // Make RN imports work in Next by mapping react-native -> react-native-web.
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      "react-native$": "react-native-web",
    };

    return config;
  },
};

export default nextConfig;
