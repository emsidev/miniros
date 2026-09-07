import { afterEach, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
const context = vi.hoisted(() => ({ pathname: "/dev/workflow-skeleton" }));
vi.mock("next/navigation", () => ({ usePathname: () => context.pathname }));
vi.mock("./device-provider", () => ({
  DeviceProvider: ({ children }: { children: React.ReactNode }) =>
    createElement("section", { "data-device-provider": true }, children),
}));
vi.mock("./pwa-provider", () => ({
  PwaProvider: () => createElement("span", { "data-pwa-provider": true }),
}));
import { ApplicationProviders } from "./application-providers";
afterEach(() => vi.unstubAllEnvs());
it("EP01 walkthrough omits legacy storage/sync providers only on its exact development route", () => {
  vi.stubEnv("NODE_ENV", "development");
  context.pathname = "/dev/workflow-skeleton";
  expect(
    renderToStaticMarkup(createElement(ApplicationProviders, null, "Preview")),
  ).toBe("Preview");
  for (const pathname of [
    "/pos",
    "/admin/shifts",
    "/dev/workflow-skeleton-other",
  ]) {
    context.pathname = pathname;
    const html = renderToStaticMarkup(
      createElement(ApplicationProviders, null, "Existing"),
    );
    expect(html).toContain("data-device-provider");
    expect(html).toContain("data-pwa-provider");
  }
  context.pathname = "/dev/workflow-skeleton";
  vi.stubEnv("NODE_ENV", "production");
  expect(
    renderToStaticMarkup(
      createElement(ApplicationProviders, null, "Denied upstream"),
    ),
  ).toContain("data-device-provider");
});
