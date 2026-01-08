/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Allow importing shared code from the parent repo (we reuse the real PromptPopup).
    externalDir: true,
  },
  transpilePackages: [
    // Shared RN code (PromptPopup) pulls these in.
    "react-native-web",
    "lucide-react-native",
    "nativewind",
  ],
  webpack: (config) => {
    // Make RN imports work in Next by mapping react-native -> react-native-web.
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      "react-native$": "react-native-web",
    };
    return config;
  },
};

export default nextConfig;
