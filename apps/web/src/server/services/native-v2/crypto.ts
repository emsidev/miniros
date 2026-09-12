import { createHash, createPublicKey, verify } from "node:crypto";
import { NativeAccessError } from "./auth";

export const nativeHash = async (value: string) =>
  createHash("sha256").update(value, "utf8").digest("hex");
export function normalizeGrantSpki(pem: string): string {
  try {
    if (
      !pem.startsWith("-----BEGIN PUBLIC KEY-----") ||
      pem.includes("PRIVATE KEY")
    )
      throw new Error();
    const key = createPublicKey(pem);
    if (key.asymmetricKeyType !== "ed25519") throw new Error();
    return key.export({ type: "spki", format: "pem" }).toString();
  } catch {
    throw new NativeAccessError(
      "KEY",
      "Use an Ed25519 installation public key.",
    );
  }
}
export function verifyNativeSignature(
  digest: string,
  signature: string,
  pem: string,
): void {
  try {
    const bytes = Buffer.from(signature, "base64");
    if (
      bytes.length !== 64 ||
      bytes.toString("base64") !== signature ||
      !verify(null, Buffer.from(digest, "utf8"), normalizeGrantSpki(pem), bytes)
    )
      throw new Error();
  } catch {
    throw new NativeAccessError(
      "SIGNATURE",
      "The installation signature could not be verified.",
    );
  }
}
