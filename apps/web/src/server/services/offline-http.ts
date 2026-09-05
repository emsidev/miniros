import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AccessError } from "./access-error";

class PayloadTooLargeError extends Error {}

export function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin)
    throw new AccessError("Open MINIROS directly to make changes.");
}
export function offlineJson(value: unknown, status = 200) {
  return NextResponse.json(value, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}
export async function offlineResponse(work: () => Promise<unknown>) {
  try {
    return offlineJson(await work());
  } catch (error) {
    if (error instanceof PayloadTooLargeError)
      return offlineJson(
        { ok: false, code: "CONFLICT", error: error.message },
        413,
      );
    if (error instanceof ZodError)
      return offlineJson(
        {
          ok: false,
          code: "CONFLICT",
          error: error.issues[0]?.message ?? "Invalid offline operation.",
        },
        400,
      );
    if (error instanceof AccessError)
      return offlineJson(
        { ok: false, code: "AUTH", error: error.message },
        403,
      );
    console.error("Offline request failed", error);
    return offlineJson(
      {
        ok: false,
        code: "RETRY",
        error:
          "The server could not save this request. Your work remains on this device; retry when service returns.",
      },
      503,
    );
  }
}

async function readOfflineBody(request: Request, maximumBytes: number) {
  const reader = request.body?.getReader();
  if (!reader)
    throw new ZodError([
      { code: "custom", path: [], message: "A request body is required." },
    ]);
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    const declaredLength = request.headers.get("content-length");
    if (declaredLength && Number(declaredLength) > maximumBytes) {
      await reader.cancel();
      throw new PayloadTooLargeError("The offline request is too large.");
    }
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > maximumBytes) {
        await reader.cancel();
        throw new PayloadTooLargeError("The offline request is too large.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const joined = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    joined.set(chunk, offset);
    offset += chunk.length;
  }
  return joined;
}

export async function readOfflineJson(request: Request) {
  const joined = await readOfflineBody(request, 1_000_000);
  try {
    return JSON.parse(new TextDecoder().decode(joined)) as unknown;
  } catch {
    throw new ZodError([
      { code: "custom", path: [], message: "Use a valid JSON request." },
    ]);
  }
}

export async function readOfflineForm(request: Request) {
  // Includes every multipart part and its overhead, not just the selected file.
  // The proof services retain their tighter 3.5 MB per-file limit.
  const body = await readOfflineBody(request, 4_000_000);
  try {
    return await new Response(body, {
      headers: { "Content-Type": request.headers.get("content-type") ?? "" },
    }).formData();
  } catch {
    throw new ZodError([
      {
        code: "custom",
        path: [],
        message: "Use a valid multipart proof request.",
      },
    ]);
  }
}
