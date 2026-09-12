import { addCents } from "../money";
import { bigintToSafeInteger, assertSafeInteger } from "../internal/rounding";
import {
  v2SnapshotBodySchema,
  v2SnapshotSchema,
  v2OperationBodySchema,
  v2OperationSchema,
  v2LineSchema,
  v2PrepCommandSchema,
  v2PrepCommandBodySchema,
} from "./schema";
import {
  V2_MAX_BYTES,
  type V2Authenticity,
  type V2Hash,
  type V2Ingredient,
  type V2Item,
  type V2Line,
  type V2Operation,
  type V2OperationBody,
  type V2Projection,
  type V2Snapshot,
  type V2SnapshotBody,
  type V2Unit,
  type V2PrepCommand,
} from "./types";

export class V2Error extends Error {
  constructor(
    readonly code: string,
    message = code,
  ) {
    super(message);
    this.name = "V2Error";
  }
}
export function utf8Length(value: string): number {
  let length = 0;
  for (const char of value) {
    const c = char.codePointAt(0)!;
    length += c <= 0x7f ? 1 : c <= 0x7ff ? 2 : c <= 0xffff ? 3 : 4;
  }
  return length;
}
/** Miniros canonical JSON v2: sorted object keys, safe integer numbers, no undefined. */
export function canonicalV2(value: unknown): string {
  const active = new Set<object>();
  function encode(input: unknown, depth: number): string {
    if (depth > 32) throw new V2Error("TOO_DEEP");
    if (
      input === null ||
      typeof input === "boolean" ||
      typeof input === "string"
    )
      return JSON.stringify(input);
    if (typeof input === "number") {
      assertSafeInteger(input);
      return JSON.stringify(input);
    }
    if (typeof input !== "object") throw new V2Error("NON_JSON");
    if (active.has(input)) throw new V2Error("CYCLIC_JSON");
    active.add(input);
    let result: string;
    if (Array.isArray(input))
      result = `[${Array.from(input, (item) => encode(item, depth + 1)).join(",")}]`;
    else {
      if (
        Object.getPrototypeOf(input) !== Object.prototype &&
        Object.getPrototypeOf(input) !== null
      )
        throw new V2Error("NON_JSON");
      const obj = input as Record<string, unknown>;
      result = `{${Object.keys(obj)
        .sort()
        .map((key) => `${JSON.stringify(key)}:${encode(obj[key], depth + 1)}`)
        .join(",")}}`;
    }
    active.delete(input);
    return result;
  }
  return encode(value, 0);
}
export function freezeV2<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freezeV2(child);
    Object.freeze(value);
  }
  return value;
}
export function cloneV2<T>(value: T): T {
  return JSON.parse(canonicalV2(value)) as T;
}
export function multiplyV2(left: number, right: number): number {
  assertSafeInteger(left);
  assertSafeInteger(right);
  return bigintToSafeInteger(BigInt(left) * BigInt(right));
}
/** Unlike legacy rounded quantities, v2 counts must be exactly representable. */
export function exactAtoms(
  value: string | number,
  item: Pick<V2Item, "unit" | "atomScale">,
  unit: V2Unit,
): number {
  if (
    unit !== item.unit ||
    ![1, 10, 100, 1000].includes(item.atomScale) ||
    (item.unit === "pc" && item.atomScale !== 1)
  )
    throw new V2Error("UNIT_MISMATCH");
  const raw = typeof value === "number" ? String(value) : value.trim();
  if (raw.length > 32 || !/^\d+(?:\.\d+)?$/.test(raw))
    throw new V2Error("INVALID_QUANTITY");
  const [whole, fraction = ""] = raw.split(".");
  const denominator = 10n ** BigInt(fraction.length);
  const numerator = BigInt(whole + fraction) * BigInt(item.atomScale);
  if (numerator % denominator !== 0n) throw new V2Error("FRACTIONAL_ATOM");
  return bigintToSafeInteger(numerator / denominator);
}
export function packCountAtoms(
  item: V2Item,
  input: {
    packId: string;
    sealedPacks: number;
    loose: string | number;
    unit: V2Unit;
  },
): number {
  assertSafeInteger(input.sealedPacks);
  if (input.sealedPacks < 0) throw new V2Error("INVALID_QUANTITY");
  const pack = item.packs.find((p) => p.id === input.packId);
  if (!pack || pack.unit !== item.unit) throw new V2Error("UNIT_MISMATCH");
  return addCents(
    multiplyV2(input.sealedPacks, pack.atoms),
    exactAtoms(input.loose, item, input.unit),
  );
}
export function validateV2SnapshotBody(input: unknown): V2SnapshotBody {
  const body = v2SnapshotBodySchema.parse(input);
  if (utf8Length(canonicalV2(body)) > V2_MAX_BYTES)
    throw new V2Error("OVERSIZED");
  const items = new Map(body.items.map((item) => [item.id, item]));
  const recipes = new Map(body.recipes.map((recipe) => [recipe.id, recipe]));
  const modifiers = new Map(
    body.modifiers.map((modifier) => [modifier.id, modifier]),
  );
  for (const item of body.items) {
    if (
      (item.unit === "pc" && item.atomScale !== 1) ||
      item.packs.some((pack) => pack.unit !== item.unit)
    )
      throw new V2Error("UNIT_MISMATCH");
  }
  const depths = new Map<string, number>();
  function visit(parts: readonly V2Ingredient[], stack: Set<string>): number {
    if (stack.size > 32) throw new V2Error("RECIPE_DEPTH");
    let depth = 0;
    for (const part of parts) {
      if (part.kind === "item") {
        if (!items.has(part.itemId)) throw new V2Error("UNKNOWN_ITEM");
      } else {
        if (stack.has(part.recipeId)) throw new V2Error("CYCLIC_RECIPE");
        const recipe = recipes.get(part.recipeId);
        if (!recipe) throw new V2Error("UNKNOWN_RECIPE");
        const nested =
          depths.get(recipe.id) ??
          visit(recipe.ingredients, new Set([...stack, part.recipeId]));
        depths.set(recipe.id, nested);
        depth = Math.max(depth, nested + 1);
      }
    }
    if (depth > 32) throw new V2Error("RECIPE_DEPTH");
    return depth;
  }
  for (const recipe of body.recipes)
    visit(recipe.ingredients, new Set([recipe.id]));
  for (const modifier of body.modifiers) visit(modifier.ingredients, new Set());
  for (const product of body.products) {
    if (!recipes.has(product.recipeId)) throw new V2Error("UNKNOWN_RECIPE");
    if (product.modifierIds.some((id) => !modifiers.has(id)))
      throw new V2Error("UNKNOWN_MODIFIER");
  }
  // Catch overflowing recipes before issuing a snapshot, using the same exact atom engine.
  for (const product of body.products)
    consumeV2Lines(body, [
      { productId: product.id, quantity: 1, modifierIds: [] },
    ]);
  return freezeV2(cloneV2(body));
}
export async function createV2Snapshot(
  input: unknown,
  hash: V2Hash,
): Promise<V2Snapshot> {
  const body = validateV2SnapshotBody(input);
  return freezeV2(
    v2SnapshotSchema.parse({ ...body, hash: await hash(canonicalV2(body)) }),
  );
}
export async function verifyV2Snapshot(
  input: unknown,
  hash: V2Hash,
): Promise<V2Snapshot> {
  const snapshot = v2SnapshotSchema.parse(input);
  const { hash: receivedHash, ...body } = snapshot;
  validateV2SnapshotBody(body);
  if ((await hash(canonicalV2(body))) !== receivedHash)
    throw new V2Error("SNAPSHOT_DIGEST");
  return freezeV2(snapshot);
}
export function operationBodyV2(operation: V2Operation): V2OperationBody {
  const { canonicalDigest, authenticity, ...body } = operation;
  void canonicalDigest;
  void authenticity;
  return v2OperationBodySchema.parse(body);
}
export async function sealV2Operation(
  input: unknown,
  authenticity: V2Authenticity,
  hash: V2Hash,
): Promise<V2Operation> {
  const body = v2OperationBodySchema.parse(input);
  const operation = v2OperationSchema.parse({
    ...body,
    canonicalDigest: await hash(canonicalV2(body)),
    authenticity,
  });
  if (utf8Length(canonicalV2(operation)) > V2_MAX_BYTES)
    throw new V2Error("OVERSIZED");
  return freezeV2(operation);
}
export async function sealV2PrepCommand(
  input: unknown,
  authenticity: V2Authenticity,
  hash: V2Hash,
): Promise<V2PrepCommand> {
  const body = v2PrepCommandBodySchema.parse(input);
  return freezeV2(
    v2PrepCommandSchema.parse({
      ...body,
      canonicalDigest: await hash(canonicalV2(body)),
      authenticity,
    }),
  );
}
export async function verifyV2PrepCommand(
  input: unknown,
  hash: V2Hash,
): Promise<V2PrepCommand> {
  const command = v2PrepCommandSchema.parse(input);
  const { authenticity, canonicalDigest, ...body } = command;
  void authenticity;
  if ((await hash(canonicalV2(body))) !== canonicalDigest)
    throw new V2Error("COMMAND_DIGEST");
  return freezeV2(command);
}
/** Structural/digest validation only. Ed25519 verification belongs to the authorized adapter. */
export async function verifyV2Operation(
  input: unknown,
  hash: V2Hash,
): Promise<V2Operation> {
  const operation = v2OperationSchema.parse(input);
  if (utf8Length(canonicalV2(operation)) > V2_MAX_BYTES)
    throw new V2Error("OVERSIZED");
  if (
    (await hash(canonicalV2(operationBodyV2(operation)))) !==
    operation.canonicalDigest
  )
    throw new V2Error("OPERATION_DIGEST");
  return freezeV2(operation);
}
export async function decodeV2Operation(
  raw: string,
  hash: V2Hash,
): Promise<V2Operation> {
  if (typeof raw !== "string" || utf8Length(raw) > V2_MAX_BYTES)
    throw new V2Error("OVERSIZED");
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new V2Error("MALFORMED");
  }
  return verifyV2Operation(value, hash);
}
export async function journalDigestV2(
  projection: V2Projection,
  hash: V2Hash,
): Promise<string> {
  const entries = Object.entries(projection.seen)
    .sort((a, b) => a[1].sequence - b[1].sequence)
    .map(([operationId, entry]) => ({
      operationId,
      sequence: entry.sequence,
      canonicalDigest: entry.digest,
    }));
  return hash(canonicalV2(entries));
}
export function consumeV2Lines(
  snapshot: V2SnapshotBody,
  input: readonly V2Line[],
): {
  consumption: Record<string, number>;
  subtotalMinor: number;
  itemQuantity: number;
} {
  const lines = input.map((line) => v2LineSchema.parse(line));
  const consumption: Record<string, number> = {};
  const recipes = new Map(
    snapshot.recipes.map((recipe) => [recipe.id, recipe]),
  );
  const memo = new Map<string, Record<string, number>>();
  function expand(
    parts: readonly V2Ingredient[],
    stack: Set<string>,
  ): Record<string, number> {
    if (stack.size > 32) throw new V2Error("RECIPE_DEPTH");
    const result: Record<string, number> = {};
    for (const part of parts) {
      if (part.kind === "item") {
        if (!snapshot.items.some((item) => item.id === part.itemId))
          throw new V2Error("UNKNOWN_ITEM");
        // Prepared stock is a leaf item. Its pre-shift production recipe is never expanded.
        result[part.itemId] = addCents(result[part.itemId] ?? 0, part.atoms);
      } else {
        const recipe = recipes.get(part.recipeId);
        if (!recipe) throw new V2Error("UNKNOWN_RECIPE");
        if (stack.has(part.recipeId)) throw new V2Error("CYCLIC_RECIPE");
        const nested =
          memo.get(recipe.id) ??
          expand(recipe.ingredients, new Set([...stack, part.recipeId]));
        memo.set(recipe.id, nested);
        for (const [id, atoms] of Object.entries(nested))
          result[id] = addCents(
            result[id] ?? 0,
            multiplyV2(atoms, part.quantity),
          );
      }
    }
    return result;
  }
  function use(
    parts: readonly V2Ingredient[],
    quantity: number,
    stack: Set<string>,
  ): void {
    for (const [id, atoms] of Object.entries(expand(parts, stack)))
      consumption[id] = addCents(
        consumption[id] ?? 0,
        multiplyV2(atoms, quantity),
      );
  }
  let subtotalMinor = 0;
  let itemQuantity = 0;
  for (const line of lines) {
    const product = snapshot.products.find((p) => p.id === line.productId);
    const recipe = product && recipes.get(product.recipeId);
    if (!product || !recipe) throw new V2Error("UNKNOWN_PRODUCT");
    let price = product.priceMinor;
    use(recipe.ingredients, line.quantity, new Set([recipe.id]));
    for (const modifierId of line.modifierIds) {
      const modifier = snapshot.modifiers.find((m) => m.id === modifierId);
      if (!product.modifierIds.includes(modifierId) || !modifier)
        throw new V2Error("INVALID_MODIFIER");
      price = addCents(price, modifier.priceMinor);
      use(modifier.ingredients, line.quantity, new Set());
    }
    subtotalMinor = addCents(subtotalMinor, multiplyV2(price, line.quantity));
    itemQuantity = addCents(itemQuantity, line.quantity);
  }
  return { consumption, subtotalMinor, itemQuantity };
}
