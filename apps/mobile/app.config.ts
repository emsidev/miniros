import type { ConfigContext, ExpoConfig } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => {
  if (process.env.EXPO_PUBLIC_MINIROS_EP02_SPIKE !== "1") {
    return config as ExpoConfig;
  }
  return {
    ...config,
    name: "MINIROS Peer Spike",
    slug: "miniros-peer-spike",
    ios: { ...config.ios, bundleIdentifier: "com.miniros.peer.spike" },
    android: { ...config.android, package: "com.miniros.peer.spike" },
    plugins: [
      ...(config.plugins ?? []),
      "./modules/miniros-peer/app.plugin.cjs",
    ],
  };
};
