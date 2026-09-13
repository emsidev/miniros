/** Version 2 is additive. Version 1 journals retain their original parser/reducer. */
export const V2_VERSION = 2 as const;
export const V2_MAX_BYTES = 262_144;
export const v2Kinds = [
  "OPEN_SHIFT",
  "SALE",
  "REFUND",
  "COMPLIMENTARY",
  "REMAKE",
  "RESTOCK",
  "WASTE",
  "ADJUST_STOCK",
  "RETURN_UNPREPARED",
  "PREP_TRANSITION",
  "CASH_ADJUSTMENT",
  "CLOSE_SHIFT",
] as const;
export type V2Kind = (typeof v2Kinds)[number];
export type V2Unit = "g" | "ml" | "pc";
export type V2Item = Readonly<{
  id: string;
  name: string;
  category: string;
  unit: V2Unit;
  atomScale: 1 | 10 | 100 | 1000;
  prepared: boolean;
  unitCostMinor: number;
  packs: readonly Readonly<{ id: string; unit: V2Unit; atoms: number }>[];
}>;
export type V2Ingredient = Readonly<
  | { kind: "item"; itemId: string; atoms: number }
  | { kind: "recipe"; recipeId: string; quantity: number }
>;
export type V2Recipe = Readonly<{
  id: string;
  ingredients: readonly V2Ingredient[];
}>;
export type V2Modifier = Readonly<{
  id: string;
  name: string;
  priceMinor: number;
  ingredients: readonly V2Ingredient[];
}>;
export type V2Product = Readonly<{
  id: string;
  name: string;
  priceMinor: number;
  costMinor: number;
  recipeId: string;
  modifierIds: readonly string[];
}>;
export type V2SnapshotBody = Readonly<{
  schemaVersion: 2;
  id: string;
  businessId: string;
  shiftId: string;
  version: number;
  catalogVersion: string;
  recipeVersion: string;
  costingVersion: string;
  checklist: Readonly<{
    id: string;
    version: number;
    entries: readonly Readonly<{
      id: string;
      label: string;
      critical: boolean;
    }>[];
  }>;
  items: readonly V2Item[];
  recipes: readonly V2Recipe[];
  products: readonly V2Product[];
  modifiers: readonly V2Modifier[];
}>;
export type V2Snapshot = V2SnapshotBody & Readonly<{ hash: string }>;
export type V2Count = Readonly<
  | { itemId: string; kind: "uncounted" }
  | { itemId: string; kind: "not-brought" }
  | { itemId: string; kind: "counted"; atoms: number }
>;
export type V2PackingAnswer = Readonly<{
  entryId: string;
  templateVersion: number;
  kind: "unchecked" | "packed" | "missing" | "authorized-exception";
  actorId: string;
  at: string;
  reason?: string;
  exceptionAuthorizationId?: string;
}>;
export type V2Line = Readonly<{
  productId: string;
  quantity: number;
  modifierIds: readonly string[];
}>;
export type V2Tender = Readonly<{
  method: "cash" | "manual_digital";
  tenderedMinor: number;
  changeMinor: number;
}>;
export type V2PrepState = "new" | "making" | "done" | "cancelled";
export type V2Payloads = {
  OPEN_SHIFT: {
    counts: readonly V2Count[];
    openingCashMinor: number;
    reviewed: true;
  };
  SALE: {
    saleId: string;
    lines: readonly V2Line[];
    discountMinor: number;
    tenders: readonly V2Tender[];
  };
  REFUND: {
    saleId: string;
    amountMinor: number;
    method: V2Tender["method"];
    reason: string;
  };
  COMPLIMENTARY: { lines: readonly V2Line[]; reason: string };
  REMAKE: { saleId: string; lines: readonly V2Line[]; reason: string };
  RESTOCK: { itemId: string; atoms: number; reason: string };
  WASTE: { itemId: string; atoms: number; reason: string };
  ADJUST_STOCK: {
    itemId: string;
    deltaAtoms: number;
    reason: string;
    approvalId: string;
  };
  RETURN_UNPREPARED: {
    saleId: string;
    prepCommandId: string;
    prepConfirmedUnprepared: true;
    physicallyReturned: true;
    reason: string;
  };
  PREP_TRANSITION: {
    saleId: string;
    commandId: string;
    prepInstallationId: string;
    next: "making" | "done";
  };
  CASH_ADJUSTMENT: {
    direction: "in" | "out";
    amountMinor: number;
    reason: string;
  };
  CLOSE_SHIFT: {
    manifestId: string;
    lastFinancialSequence: number;
    journalDigest: string;
    expectedCashMinor: number;
    netSalesMinor: number;
    expectedStockAtoms: Readonly<Record<string, number>>;
    actualCashMinor: number | null;
    counts: readonly V2Count[];
    pendingAttachmentIds: readonly string[];
    manualResolutions: readonly Readonly<{ saleId: string; reason: string }>[];
  };
};
export type V2OperationBody<K extends V2Kind = V2Kind> = Readonly<{
  protocolVersion: 2;
  schemaVersion: 2;
  operationId: string;
  businessId: string;
  shiftId: string;
  snapshotId: string;
  snapshotHash: string;
  installationId: string;
  authorityEpoch: number;
  sequence: number;
  occurredAt: string;
}> &
  { [P in K]: Readonly<{ kind: P; payload: Readonly<V2Payloads[P]> }> }[K];
export type V2Authenticity = Readonly<{
  scheme: "ed25519";
  grantId: string;
  signature: string;
}>;
export type V2Operation<K extends V2Kind = V2Kind> = V2OperationBody<K> &
  Readonly<{ canonicalDigest: string; authenticity: V2Authenticity }>;
export type V2Hash = (canonical: string) => Promise<string>;
/** Adapter-verified prep evidence; booleans in a cashier payload are not proof. */
export type V2PrepConfirmation = Readonly<{
  commandId: string;
  saleId: string;
  prepInstallationId: string;
  action: "making" | "done" | "unprepared-return";
}>;
/** Trusted approval is bound to this exact operation; payload IDs alone grant nothing. */
export type V2StockApproval = Readonly<{
  approvalId: string;
  operationId: string;
  itemId: string;
  deltaAtoms: number;
}>;
export type V2PrepCommandBody = Readonly<{
  schemaVersion: 2;
  protocolVersion: 2;
  commandId: string;
  businessId: string;
  shiftId: string;
  snapshotId: string;
  snapshotHash: string;
  installationId: string;
  authorityEpoch: number;
  saleId: string;
  action: V2PrepConfirmation["action"];
  occurredAt: string;
}>;
export type V2PrepCommand = V2PrepCommandBody &
  Readonly<{ canonicalDigest: string; authenticity: V2Authenticity }>;
export type V2Actor = Readonly<{
  businessId: string;
  shiftId: string;
  installationId: string;
  cashierInstallationId: string;
  authorityEpoch: number;
  role: "cashier" | "prep";
  allowedKinds: readonly V2Kind[];
  verifiedPrepCommands?: readonly V2PrepConfirmation[];
  verifiedStockApprovals?: readonly V2StockApproval[];
}>;
export type V2Order = {
  saleId: string;
  lines: readonly V2Line[];
  totalMinor: number;
  cashMinor: number;
  digitalMinor: number;
  refundedCashMinor: number;
  refundedDigitalMinor: number;
  consumption: Record<string, number>;
  prepState: V2PrepState;
  returned: boolean;
};
export type V2Projection = {
  schemaVersion: 2;
  businessId: string;
  shiftId: string;
  snapshotId: string;
  snapshotHash: string;
  authorityEpoch: number;
  cashierInstallationId: string;
  lastSequence: number;
  state: "unopened" | "open" | "closed";
  stockAtoms: Record<string, number>;
  openingCashMinor: number;
  grossSalesMinor: number;
  discountsMinor: number;
  refundsMinor: number;
  retainedCashSalesMinor: number;
  cashRefundsMinor: number;
  manualDigitalMinor: number;
  cashPaidInMinor: number;
  cashPaidOutMinor: number;
  paidOrderCount: number;
  paidItemQuantity: number;
  complimentaryItemQuantity: number;
  remadeItemQuantity: number;
  orders: Record<string, V2Order>;
  seen: Record<string, { digest: string; canonical: string; sequence: number }>;
  prepCommands: Record<string, string>;
  closing: V2Payloads["CLOSE_SHIFT"] | null;
};
export type V2Summary = Readonly<{
  grossSalesMinor: number;
  discountsMinor: number;
  refundsMinor: number;
  netSalesMinor: number;
  netCashSalesMinor: number;
  netManualDigitalMinor: number;
  expectedCashMinor: number;
  stockAtoms: Readonly<Record<string, number>>;
}>;
export type V2Receipt = Readonly<{
  schemaVersion: 2;
  operationId: string;
  businessId: string;
  shiftId: string;
  authorityEpoch: number;
  installationId: string;
  snapshotId: string;
  snapshotHash: string;
  sequence: number;
  canonicalDigest: string;
  destination: "peer" | "cloud";
  receivedAt: string;
  outcome: "committed";
}>;
export type V2Draft = Readonly<{
  id: string;
  businessId: string;
  shiftId: string;
  snapshotId: string;
  snapshotHash: string;
  kind: "packing" | "opening" | "cart";
  revision: number;
  data: Readonly<{
    answers?: readonly V2PackingAnswer[];
    counts?: readonly V2Count[];
    openingCashMinor?: number;
    lines?: readonly V2Line[];
    text?: string;
    category?: string;
    uncountedOnly?: boolean;
  }>;
}>;
