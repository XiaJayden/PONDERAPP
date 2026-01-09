/** @type {import('next').NextConfig} */
// #region agent log
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { existsSync } = require("fs");
const { join } = require("path");
const webpack = require("webpack");
function logDebug(data) {
  const payload = JSON.stringify({...data, timestamp: Date.now(), sessionId: "debug-session"});
  fetch('http://127.0.0.1:7243/ingest/aff388a3-96fd-4fa2-9425-e1475bf41c13',{method:'POST',headers:{'Content-Type':'application/json'},body:payload}).catch(()=>{});
  console.log("[DEBUG]", payload);
}
// #endregion

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
    // #region agent log
    logDebug({runId: "build-2", hypothesisId: "E", location: "next.config.mjs:webpack", message: "Webpack config called", data: {isServer, dir, hasResolve: !!config.resolve, hasAlias: !!config.resolve?.alias}});
    // #endregion
    
    // Ensure resolve.modules prioritizes dashboard's node_modules
    if (!config.resolve.modules) {
      config.resolve.modules = ["node_modules"];
    }
    
    // #region agent log
    const originalModules = [...(config.resolve.modules || [])];
    const dashboardNodeModules = join(dir, "node_modules");
    const rnWebPath = join(dashboardNodeModules, "react-native-web");
    const rnWebExists = existsSync(rnWebPath);
    logDebug({runId: "build-2", hypothesisId: "E", location: "next.config.mjs:webpack", message: "Checking react-native-web", data: {dashboardNodeModules, rnWebPath, rnWebExists, originalModules: originalModules.slice(0, 3)}});
    // #endregion
    
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
    
    // #region agent log
    logDebug({runId: "build-3", hypothesisId: "F", location: "next.config.mjs:webpack", message: "Resolve config updated", data: {modules: config.resolve.modules.slice(0, 3), extensions: config.resolve.extensions.slice(0, 6)}});
    // #endregion
    
    // Make RN imports work in Next by mapping react-native -> react-native-web.
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      "react-native$": "react-native-web",
    };
    
    // #region agent log
    logDebug({runId: "build-4", hypothesisId: "G", location: "next.config.mjs:webpack", message: "After setting alias", data: {hasReactNativeAlias: config.resolve.alias["react-native$"] === "react-native-web"}});
    // #endregion
    
    return config;
  },
};

// #region agent log
logDebug({runId: "build-1", hypothesisId: "D", location: "next.config.mjs:export", message: "Config exported", data: {hasWebpack: typeof nextConfig.webpack === "function", transpilePackages: nextConfig.transpilePackages}});
// #endregion

export default nextConfig;
