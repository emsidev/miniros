import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { afterEach, expect, it, vi } from "vitest";

const source = readFileSync(new URL("./sw.js", import.meta.url), "utf8");

function navigate(fetch: ReturnType<typeof vi.fn>) {
  const handlers: Record<string, (event: unknown) => void> = {};
  const cached = new Response("Saved shifts");
  const match = vi.fn().mockResolvedValue(cached);
  runInNewContext(source, {
    self: {
      location: { origin: "https://miniros.test" },
      addEventListener: (name: string, handler: (event: unknown) => void) => {
        handlers[name] = handler;
      },
    },
    fetch,
    caches: { open: async () => ({ match }) },
    URL,
    Response,
    AbortController,
    setTimeout,
    clearTimeout,
  });
  let response!: Promise<Response>;
  handlers.fetch({
    request: {
      url: "https://miniros.test/shifts",
      method: "GET",
      mode: "navigate",
    },
    respondWith: (value: Promise<Response>) => {
      response = value;
    },
  });
  return { response, match, cached };
}

afterEach(() => vi.useRealTimers());

it("keeps loading the requested page after five seconds", async () => {
  vi.useFakeTimers();
  const page = new Response("My shifts");
  const fetch = vi.fn(
    (_request, options) =>
      new Promise<Response>((resolve, reject) => {
        setTimeout(() => resolve(page), 8000);
        options?.signal.addEventListener("abort", () =>
          reject(new Error("aborted")),
        );
      }),
  );
  const navigation = navigate(fetch);
  await vi.advanceTimersByTimeAsync(6000);
  expect(navigation.match).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(2000);
  expect(await navigation.response).toBe(page);
});

it("preserves server errors instead of silently opening saved shifts", async () => {
  const page = new Response("Server error", { status: 500 });
  const navigation = navigate(vi.fn().mockResolvedValue(page));
  expect(await navigation.response).toBe(page);
  expect(navigation.match).not.toHaveBeenCalled();
});

it("still opens saved shifts when the network fails", async () => {
  const navigation = navigate(
    vi.fn().mockRejectedValue(new TypeError("Failed to fetch")),
  );
  expect(await navigation.response).toBe(navigation.cached);
});
