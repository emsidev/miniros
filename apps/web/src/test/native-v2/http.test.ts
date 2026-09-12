import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { V2_MAX_BYTES } from "@miniros/domain/v2";
const auth = vi.hoisted(() => ({ getUser: vi.fn() }));
vi.mock("@supabase/supabase-js", () => ({ createClient: () => ({ auth }) }));
import {
  authenticateNative,
  assertNativeIdentity,
  type NativeIdentity,
} from "@/server/services/native-v2/auth";
import { nativeEndpoint } from "@/server/services/native-v2/http";

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://synthetic.example.test");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "public-test-key");
  auth.getUser
    .mockReset()
    .mockResolvedValue({ data: { user: { id: randomUUID() } }, error: null });
});
afterEach(() => vi.unstubAllEnvs());
const request = (
  body = "{}",
  headers: HeadersInit = { authorization: "Bearer valid-test-token" },
) =>
  new Request("http://localhost/api/native/v2/ingest", {
    method: "POST",
    headers,
    body,
  });

it("native identity requires live getUser(bearer); cookie-only and forged objects cannot authorize", async () => {
  const callback = vi.fn();
  const cookieOnly = await nativeEndpoint(
    request("{}", { cookie: "sb-access-token=valid-test-token" }),
    callback,
  );
  expect(cookieOnly.status).toBe(403);
  expect(callback).not.toHaveBeenCalled();
  expect(auth.getUser).not.toHaveBeenCalled();
  expect(() =>
    assertNativeIdentity({ userId: randomUUID() } as NativeIdentity),
  ).toThrow();
  const identity = await authenticateNative(request());
  expect(auth.getUser).toHaveBeenCalledWith("valid-test-token");
  expect(() => assertNativeIdentity(identity)).not.toThrow();
  auth.getUser.mockResolvedValueOnce({
    data: { user: null },
    error: new Error("expired"),
  });
  expect((await nativeEndpoint(request(), callback)).status).toBe(403);
  expect(callback).not.toHaveBeenCalled();
});
it("native adapter bounds streamed bytes and returns no-store errors without echoing tokens or database detail", async () => {
  const work = vi.fn().mockResolvedValue({ ok: true });
  expect(
    (await nativeEndpoint(request("x".repeat(V2_MAX_BYTES + 1)), work)).status,
  ).toBe(413);
  expect((await nativeEndpoint(request("not-json"), work)).status).toBe(400);
  expect(work).not.toHaveBeenCalled();
  const failed = await nativeEndpoint(request(), async () => {
    throw new Error("secret database password and bearer token");
  });
  expect(failed.status).toBe(503);
  expect(await failed.text()).not.toContain("secret");
  const passed = await nativeEndpoint(
    request('{"businessId":"example"}'),
    async (identity, body) => {
      assertNativeIdentity(identity);
      return body;
    },
  );
  expect(passed.status).toBe(200);
  expect(passed.headers.get("cache-control")).toBe("no-store");
  expect(passed.headers.get("access-control-allow-origin")).toBeNull();
});
