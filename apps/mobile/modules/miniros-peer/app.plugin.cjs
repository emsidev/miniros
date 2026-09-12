const {
  withInfoPlist,
  withAndroidManifest,
  withPodfile,
} = require("expo/config-plugins");
const { createHash } = require("node:crypto");
const serviceId = "com.miniros.peer.spike.v1";
module.exports = function withMinirosPeer(config) {
  config = withInfoPlist(config, (config) => {
    config.modResults.NSBluetoothAlwaysUsageDescription =
      "Connect the two MINIROS test phones nearby, without internet.";
    config.modResults.NSLocalNetworkUsageDescription =
      "Send numbered test messages between the two MINIROS test phones.";
    const service =
      "_" +
      createHash("sha256").update(serviceId).digest("hex").slice(0, 24) +
      "._tcp";
    config.modResults.NSBonjourServices = Array.from(
      new Set([...(config.modResults.NSBonjourServices || []), service]),
    );
    return config;
  });
  config = withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;
    const permissions = [
      ["android.permission.ACCESS_WIFI_STATE"],
      ["android.permission.CHANGE_WIFI_STATE"],
      ["android.permission.BLUETOOTH", "30"],
      ["android.permission.BLUETOOTH_ADMIN", "30"],
      ["android.permission.ACCESS_FINE_LOCATION", "31"],
      ["android.permission.BLUETOOTH_ADVERTISE"],
      ["android.permission.BLUETOOTH_CONNECT"],
      ["android.permission.BLUETOOTH_SCAN"],
      ["android.permission.NEARBY_WIFI_DEVICES"],
      ["android.permission.ACCESS_LOCAL_NETWORK"],
    ];
    manifest["uses-permission"] ||= [];
    for (const [name, max] of permissions) {
      if (
        !manifest["uses-permission"].some(
          (item) => item.$["android:name"] === name,
        )
      )
        manifest["uses-permission"].push({
          $: {
            "android:name": name,
            ...(max ? { "android:maxSdkVersion": max } : {}),
          },
        });
    }
    return config;
  });
  return withPodfile(config, (config) => {
    const marker = "# MINIROS EP02 pinned Nearby SwiftPM integration";
    if (!config.modResults.contents.includes(marker))
      config.modResults.contents += `\n${marker}\nrequire_relative '../modules/miniros-peer/ios/nearby_spm'\npost_integrate do |installer|\n  MinirosNearby.install(installer.pods_project)\nend\n`;
    return config;
  });
};
