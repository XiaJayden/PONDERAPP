// Babel config for Expo + expo-router + NativeWind.
// Keeping this explicit (instead of relying on implicit defaults) makes it easier to debug
// issues across iOS/Android/web and aligns with the project rule to add debug-friendly structure.
module.exports = function (api) {
  api.cache(true);

  // NativeWind v4 babel plugin returns an object with plugins array, so we need to extract it
  const nativewindBabel = require("nativewind/babel")();

  // Filter out react-native-worklets/plugin and react-native-reanimated/plugin from NativeWind's plugins
  // since we'll add react-native-reanimated/plugin explicitly at the end (which includes worklets)
  const nativewindPlugins = nativewindBabel.plugins.filter(
    (plugin) => {
      const pluginPath = Array.isArray(plugin) ? plugin[0] : plugin;
      const pluginStr = typeof pluginPath === 'string' ? pluginPath : pluginPath?.request || '';
      return (
        !pluginStr.includes('react-native-worklets/plugin') &&
        !pluginStr.includes('react-native-reanimated/plugin')
      );
    }
  );

  return {
    presets: ["babel-preset-expo"],
    plugins: [
      // Required for expo-router file-based routing.
      "expo-router/babel",

      // Enables `className` for React Native components via NativeWind.
      // NativeWind v4 returns an object with a plugins array, so we spread it
      // (filtered to remove duplicate worklets/reanimated plugins)
      ...nativewindPlugins,

      // Must be last (per Reanimated docs) if present.
      "react-native-reanimated/plugin",
    ],
  };
};


