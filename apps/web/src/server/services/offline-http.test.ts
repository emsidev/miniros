import { describe, expect, it, vi } from "vitest";
import {
  offlineResponse,
  readOfflineForm,
  readOfflineJson,
} from "./offline-http";

function streamedRequest(chunks: Uint8Array[], contentLength?: string) {
  const cancel = vi.fn();
  const stream = new ReadableStream({
    pull(controller) {
      const chunk = chunks.shift();
      if (chunk) controller.enqueue(chunk);
      else controller.close();
    },
    cancel,
  });
  const headers: Record<string, string> = {
    "Content-Type": "multipart/form-data; boundary=test",
  };
  if (contentLength) headers["Content-Length"] = contentLength;
  return {
    cancel,
    request: new Request("https://miniros.test/api/offline/proof", {
      method: "POST",
      headers,
      body: stream,
      duplex: "half",
    } as RequestInit),
  };
}

describe("bounded offline bodies", () => {
  it.each([undefined, "1"])(
    "rejects oversized streamed multipart despite length %s",
    async (length) => {
      const { request, cancel } = streamedRequest(
        [
          new Uint8Array(2_000_001),
          new Uint8Array(2_000_000),
          new Uint8Array(1),
        ],
        length,
      );
      const response = await offlineResponse(() => readOfflineForm(request));
      expect(response.status).toBe(413);
      expect(cancel).toHaveBeenCalledOnce();
      expect((await response.json()).code).toBe("CONFLICT");
    },
  );
  it("bounds extra form fields even when the selected proof is tiny", async () => {
    const form = new FormData();
    form.set("file", new File(["small"], "proof.jpg", { type: "image/jpeg" }));
    form.set("extra", "x".repeat(4_000_000));
    const encoded = new Response(form);
    const request = new Request("https://miniros.test", {
      method: "POST",
      headers: encoded.headers,
      body: await encoded.arrayBuffer(),
    });
    expect((await offlineResponse(() => readOfflineForm(request))).status).toBe(
      413,
    );
  });
  it("preserves a maximum-sized valid proof and multipart metadata", async () => {
    const form = new FormData();
    form.set("fileId", "test-file");
    form.set(
      "file",
      new File([new Uint8Array(3_500_000)], "proof.jpg", {
        type: "image/jpeg",
      }),
    );
    const parsed = await readOfflineForm(
      new Request("https://miniros.test", { method: "POST", body: form }),
    );
    expect(parsed.get("fileId")).toBe("test-file");
    expect((parsed.get("file") as File).size).toBe(3_500_000);
  });
  it("rejects malformed multipart with a client error", async () => {
    const request = new Request("https://miniros.test", {
      method: "POST",
      body: "invalid",
    });
    expect((await offlineResponse(() => readOfflineForm(request))).status).toBe(
      400,
    );
  });
  it("retains valid JSON and bounds oversized JSON", async () => {
    const valid = new Request("https://miniros.test", {
      method: "POST",
      body: '{"ok":true}',
    });
    expect(await readOfflineJson(valid)).toEqual({ ok: true });
    const invalid = new Request("https://miniros.test", {
      method: "POST",
      body: "x".repeat(1_000_001),
    });
    expect((await offlineResponse(() => readOfflineJson(invalid))).status).toBe(
      413,
    );
  });
});
