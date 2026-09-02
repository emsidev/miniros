export type CatalogSkuPrefix = "PRD" | "INV";

const MAX_SKU_LENGTH = 80;

export function normalizeSku(value: string) {
  return value.trim().toUpperCase();
}

export function skuNameSegment(name: string) {
  const segment = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-");

  return segment || "ITEM";
}

export function formatAutomaticSku(
  prefix: CatalogSkuPrefix,
  name: string,
  suffix: string,
) {
  const normalizedSuffix = suffix
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 4);

  if (normalizedSuffix.length !== 4) {
    throw new Error(
      "SKU suffix must contain at least four letters or numbers.",
    );
  }

  const head = `${prefix}-`;
  const tail = `-${normalizedSuffix}`;
  const maxNameLength = MAX_SKU_LENGTH - head.length - tail.length;
  const nameSegment = skuNameSegment(name)
    .slice(0, maxNameLength)
    .replace(/-+$/g, "");

  return `${head}${nameSegment || "ITEM"}${tail}`;
}

export async function selectAvailableAutomaticSku({
  prefix,
  name,
  nextSuffix,
  isAvailable,
  maxAttempts = 10,
}: {
  prefix: CatalogSkuPrefix;
  name: string;
  nextSuffix: () => string;
  isAvailable: (sku: string) => Promise<boolean> | boolean;
  maxAttempts?: number;
}) {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const sku = formatAutomaticSku(prefix, name, nextSuffix());
    if (await isAvailable(sku)) return sku;
  }

  throw new Error("Could not generate an available SKU.");
}
