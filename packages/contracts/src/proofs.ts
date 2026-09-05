export const MAX_PROOF_BYTES = 3_500_000;
export const PHOTO_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export function validateProofFile(
  file: Pick<File, "type" | "size"> | null | undefined,
  photoOnly = false,
): string | null {
  if (!file) return "Attach a photo before applying this discount.";
  if (file.size <= 0 || file.size > MAX_PROOF_BYTES)
    return "Choose a file larger than 0 bytes and no larger than 3.5 MB.";
  if (
    !(PHOTO_MIME_TYPES as readonly string[]).includes(file.type) &&
    (photoOnly || file.type !== "application/pdf")
  )
    return photoOnly
      ? "Choose a JPEG, PNG, or WebP photo."
      : "Choose a JPEG, PNG, WebP, or PDF proof.";
  return null;
}
