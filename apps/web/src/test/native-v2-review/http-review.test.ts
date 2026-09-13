import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { middleware } from "../../middleware";
import { nativeEndpoint } from "../../server/services/native-v2/http";
import { assertNativeIdentity } from "../../server/services/native-v2/auth";

const boundary = vi.hoisted(() => ({
  refresh: vi.fn(async () => {
    throw new Error("stale web cookie refresh");
  }),
  getUser: vi.fn(async (token: string) =>
    token === "validated-token"
      ? {
          data: { user: { id: "33333333-3333-4333-8333-333333333333" } },
          error: null,
        }
      : { data: { user: null }, error: new Error("invalid bearer") },
  ),
}));
vi.mock("../../lib/supabase/middleware", () => ({
  updateSession: boundary.refresh,
}));
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({ auth: { getUser: boundary.getUser } }),
}));
beforeAll(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://synthetic-review.invalid");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "synthetic-review-key");
});
afterAll(() => {
  vi.unstubAllEnvs();
});
function request(body: BodyInit = "{}", bearer = true) {
  return new Request("http://localhost/api/native/v2/ingest", {
    method: "POST",
    headers: {
      ...(bearer ? { authorization: "Bearer validated-token" } : {}),
      cookie: "sb-stale-auth-token=malformed",
      "content-type": "application/json",
    },
    body,
  });
}

describe("EP05 independent native HTTP auth and middleware boundary", () => {
  it("stale web cookies cannot invoke refresh on exact native route prefix; adjacent routes retain web behavior", async () => {
    const result = await middleware(
      new NextRequest("http://localhost/api/native/v2/ingest", {
        headers: { cookie: "sb-stale-auth-token=malformed" },
      }),
    );
    expect(result.status).toBe(200);
    expect(boundary.refresh).not.toHaveBeenCalled();
    await expect(
      middleware(new NextRequest("http://localhost/api/native/v2-other")),
    ).rejects.toThrow("stale web cookie refresh");
  });
  it("EP05-T04 cookie alone remains403 and validated Bearer is required after middleware bypass", async () => {
    const work = vi.fn(async (identity) => {
      assertNativeIdentity(identity);
      return { ok: true };
    });
    const denied = await nativeEndpoint(request("{}", false), work);
    expect(denied.status).toBe(403);
    expect(work).not.toHaveBeenCalled();
    const accepted = await nativeEndpoint(request(), work);
    expect(accepted.status).toBe(200);
    expect(work).toHaveBeenCalledOnce();
    expect(boundary.getUser).toHaveBeenCalledWith("validated-token");
    expect(accepted.headers.get("cache-control")).toBe("no-store");
  });
  it("oversized bytes and malformed UTF8 reject before application code without trusting content-length", async () => {
    const work = vi.fn(async () => ({ ok: true }));
    const huge = request(JSON.stringify({ data: "a".repeat(262144) }));
    huge.headers.set("content-length", "2");
    expect((await nativeEndpoint(huge, work)).status).toBe(413);
    expect(
      (await nativeEndpoint(request(new Uint8Array([0xc3, 0x28])), work))
        .status,
    ).toBe(400);
    expect((await nativeEndpoint(request("{broken"), work)).status).toBe(400);
    expect(work).not.toHaveBeenCalled();
  });
  it("unexpected failures return a bounded retry message without database SQL or credentials", async () => {
    const result = await nativeEndpoint(request(), async () => {
      throw new Error("SELECT secret FROM passwords; bearer private-secret");
    });
    expect(result.status).toBe(503);
    expect(await result.text()).not.toMatch(/SELECT|private-secret|passwords/);
  });
});
