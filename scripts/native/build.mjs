import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const platform = process.argv[2];
const checkOnly = process.argv.includes("--check");
if (!["android", "ios"].includes(platform)) {
  console.error("Usage: node scripts/native/build.mjs android|ios [--check]");
  process.exit(1);
}
const probe = (command, args) => spawnSync(command, args, { encoding: "utf8" });
const missing = [];
if (platform === "android") {
  if (probe("java", ["-version"]).status !== 0)
    missing.push("Java runtime/JDK");
  const sdk =
    process.env.ANDROID_HOME ||
    process.env.ANDROID_SDK_ROOT ||
    resolve(homedir(), "Library/Android/sdk");
  if (!existsSync(resolve(sdk, "platform-tools/adb")))
    missing.push("Android SDK with platform-tools/adb");
} else {
  if (
    process.platform !== "darwin" ||
    probe("xcodebuild", ["-version"]).status !== 0
  )
    missing.push("full Xcode and an active Xcode developer directory");
  if (probe("pod", ["--version"]).status !== 0) missing.push("CocoaPods");
}
if (missing.length) {
  console.error(
    JSON.stringify(
      { platform, result: "BLOCKED", missing, physicalEvidence: false },
      null,
      2,
    ),
  );
  process.exit(2);
}
if (checkOnly) {
  console.log(
    JSON.stringify({
      platform,
      result: "PREREQUISITES_AVAILABLE",
      physicalEvidence: false,
    }),
  );
  process.exit(0);
}
// Expo compiles the generated native project. A build is still not physical acceptance.
const result = spawnSync(
  "corepack",
  [
    "pnpm",
    "--filter",
    "@miniros/mobile",
    "exec",
    "expo",
    `run:${platform}`,
    "--no-bundler",
    ...(platform === "android"
      ? ["--variant", "release"]
      : ["--configuration", "Release"]),
  ],
  {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env, EXPO_PUBLIC_MINIROS_EP02_SPIKE: "1" },
  },
);
process.exit(result.status ?? 1);
