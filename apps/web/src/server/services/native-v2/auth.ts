import { v2IdSchema } from "@miniros/domain/v2";
import { createNativeAuthClient } from "@/lib/supabase/native";

const verifiedIdentity = Symbol("native bearer identity");
/** Server-only identity. HTTP payloads never construct this value. */
export type NativeIdentity = Readonly<{
  userId: string;
  [verifiedIdentity]: true;
}>;
export class NativeAccessError extends Error {
  constructor(
    readonly code = "AUTH",
    message = "Native authorization is required.",
  ) {
    super(message);
    this.name = "NativeAccessError";
  }
}
export function assertNativeIdentity(identity: NativeIdentity): void {
  if (identity?.[verifiedIdentity] !== true) throw new NativeAccessError();
}
export async function authenticateNative(
  request: Request,
): Promise<NativeIdentity> {
  const authorization = request.headers.get("authorization");
  if (
    !authorization ||
    authorization.length > 8192 ||
    !/^Bearer [^\s]+$/.test(authorization)
  ) {
    throw new NativeAccessError();
  }
  const client = createNativeAuthClient();
  // A verified server response, not decoded JWT claims or cookie authentication.
  const { data, error } = await client.auth.getUser(authorization.slice(7));
  if (error || !data.user || !v2IdSchema.safeParse(data.user.id).success)
    throw new NativeAccessError();
  return Object.freeze({
    userId: data.user.id,
    [verifiedIdentity]: true as const,
  });
}
