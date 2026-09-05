export function safeObjectName(fileId: string, originalName: string) {
  const cleaned = originalName
    .normalize("NFKC")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^[.-]+|[.-]+$/g, "")
    .slice(0, 96);
  return `${fileId}-${cleaned || "proof"}`;
}

export async function hasExpectedSignature(file: File) {
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const startsWith = (...signature: number[]) =>
    signature.every((byte, index) => bytes[index] === byte);

  switch (file.type) {
    case "application/pdf":
      return startsWith(0x25, 0x50, 0x44, 0x46, 0x2d);
    case "image/jpeg":
      return startsWith(0xff, 0xd8, 0xff);
    case "image/png":
      return startsWith(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
    case "image/webp":
      return (
        startsWith(0x52, 0x49, 0x46, 0x46) &&
        bytes[8] === 0x57 &&
        bytes[9] === 0x45 &&
        bytes[10] === 0x42 &&
        bytes[11] === 0x50
      );
    default:
      return false;
  }
}
