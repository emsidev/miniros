import { ZodError } from "zod";
import { V2Error, V2_MAX_BYTES } from "@miniros/domain/v2";
import {
  authenticateNative,
  NativeAccessError,
  type NativeIdentity,
} from "./auth";

export async function readNativeJson(request: Request): Promise<unknown> {
  const reader = request.body?.getReader();
  if (!reader)
    throw new NativeAccessError("INVALID", "A JSON body is required.");
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      length += part.value.byteLength;
      if (length > V2_MAX_BYTES) {
        await reader.cancel();
        throw new NativeAccessError("OVERSIZED");
      }
      chunks.push(part.value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    throw new NativeAccessError("INVALID", "Use a valid UTF-8 JSON body.");
  }
}
export async function nativeEndpoint(
  request: Request,
  work: (identity: NativeIdentity, body: unknown) => Promise<unknown>,
): Promise<Response> {
  const json = (body: unknown, status = 200) =>
    Response.json(body, {
      status,
      headers: {
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  try {
    const identity = await authenticateNative(request);
    return json(await work(identity, await readNativeJson(request)));
  } catch (error) {
    if (error instanceof NativeAccessError)
      return json(
        { ok: false, code: error.code, error: error.message },
        error.code === "OVERSIZED" ? 413 : error.code === "INVALID" ? 400 : 403,
      );
    if (error instanceof ZodError || error instanceof V2Error)
      return json(
        {
          ok: false,
          code: "INVALID",
          error:
            "The native request is invalid; preserve the original local work.",
        },
        400,
      );
    // Never log the request, token, signed envelope, raw database SQL, or key.
    return json(
      {
        ok: false,
        code: "RETRY",
        error:
          "Cloud saving is unavailable. Your local work remains on the device; retry later.",
      },
      503,
    );
  }
}
