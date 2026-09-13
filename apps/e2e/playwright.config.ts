import { defineConfig } from "@playwright/test";
import { resolve } from "node:path";
const root = resolve(__dirname, "../..");
export default defineConfig({
  testDir: "./browser",
  testMatch: "**/*.spec.ts",
  timeout: 90000,
  workers: 1,
  reporter: "list",
  use: { baseURL: "http://127.0.0.1:4321", trace: "retain-on-failure" },
  webServer: [
    {
      command: "pnpm --filter @miniros/web exec next start --port 4320",
      cwd: root,
      url: "http://127.0.0.1:4320/offline",
      reuseExistingServer: !process.env.CI,
    },
    {
      command: "pnpm exec tsx apps/e2e/browser/server.mts",
      cwd: root,
      url: "http://127.0.0.1:4321/__readiness",
      reuseExistingServer: !process.env.CI,
    },
  ],
  projects: [
    {
      name: "chromium",
      use: { browserName: "chromium" },
      grepInvert: /\[render\]/,
    },
    {
      name: "brave",
      use: {
        browserName: "chromium",
        launchOptions: {
          executablePath:
            "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
        },
      },
      grepInvert: /\[render\]|\[worker\]/,
    },
    {
      name: "chrome",
      use: { browserName: "chromium", channel: "chrome" },
      grepInvert: /\[render\]|\[worker\]/,
    },
    {
      name: "firefox",
      use: { browserName: "firefox" },
      grepInvert: /\[render\]|\[worker\]/,
    },
    {
      name: "webkit-rendering",
      use: { browserName: "webkit", viewport: { width: 375, height: 812 } },
      grep: /\[render\]/,
    },
  ],
});
