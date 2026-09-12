import { addCents } from "../money";
import { assertSafeInteger } from "../internal/rounding";
import {
  canonicalV2,
  cloneV2,
  consumeV2Lines,
  freezeV2,
  journalDigestV2,
  multiplyV2,
  operationBodyV2,
  validateV2SnapshotBody,
  verifyV2Operation,
  verifyV2Snapshot,
  V2Error,
} from "./core";
import { v2IdSchema, v2SnapshotSchema } from "./schema";
import {
  v2Kinds,
  type V2Actor,
  type V2Count,
  type V2Hash,
  type V2Line,
  type V2Operation,
  type V2Order,
  type V2Projection,
  type V2Snapshot,
  type V2Summary,
} from "./types";

function assertActor(snapshot: V2Snapshot, actor: V2Actor): void {
  for (const id of [
    actor.businessId,
    actor.shiftId,
    actor.installationId,
    actor.cashierInstallationId,
  ])
    v2IdSchema.parse(id);
  assertSafeInteger(actor.authorityEpoch);
  if (
    actor.businessId !== snapshot.businessId ||
    actor.shiftId !== snapshot.shiftId ||
    actor.authorityEpoch < 1 ||
    actor.role !== "cashier" ||
    actor.installationId !== actor.cashierInstallationId ||
    actor.allowedKinds.some((kind) => !v2Kinds.includes(kind))
  )
    throw new V2Error("UNAUTHORIZED_ACTOR");
}
function assertProjection(
  snapshot: V2Snapshot,
  projection: V2Projection,
  actor: V2Actor,
): void {
  if (
    projection.schemaVersion !== 2 ||
    projection.businessId !== snapshot.businessId ||
    projection.shiftId !== snapshot.shiftId ||
    projection.snapshotId !== snapshot.id ||
    projection.snapshotHash !== snapshot.hash ||
    projection.authorityEpoch !== actor.authorityEpoch ||
    projection.cashierInstallationId !== actor.cashierInstallationId
  )
    throw new V2Error("PROJECTION_SCOPE");
  assertSafeInteger(projection.lastSequence);
  if (projection.lastSequence < 0) throw new V2Error("INVALID_SEQUENCE");
}
export function initialV2Projection(
  snapshot: V2Snapshot,
  actor: V2Actor,
): V2Projection {
  const parsed = v2SnapshotSchema.parse(snapshot);
  const { hash, ...body } = parsed;
  void hash;
  validateV2SnapshotBody(body);
  assertActor(parsed, actor);
  return freezeV2({
    schemaVersion: 2,
    businessId: parsed.businessId,
    shiftId: parsed.shiftId,
    snapshotId: parsed.id,
    snapshotHash: parsed.hash,
    authorityEpoch: actor.authorityEpoch,
    cashierInstallationId: actor.cashierInstallationId,
    lastSequence: 0,
    state: "unopened",
    stockAtoms: Object.fromEntries(parsed.items.map((item) => [item.id, 0])),
    openingCashMinor: 0,
    grossSalesMinor: 0,
    discountsMinor: 0,
    refundsMinor: 0,
    retainedCashSalesMinor: 0,
    cashRefundsMinor: 0,
    manualDigitalMinor: 0,
    cashPaidInMinor: 0,
    cashPaidOutMinor: 0,
    paidOrderCount: 0,
    paidItemQuantity: 0,
    complimentaryItemQuantity: 0,
    remadeItemQuantity: 0,
    orders: {},
    seen: {},
    prepCommands: {},
    closing: null,
  });
}
export function summaryV2(projection: V2Projection): V2Summary {
  const netCashSalesMinor = addCents(
    projection.retainedCashSalesMinor,
    -projection.cashRefundsMinor,
  );
  const digitalRefunds = addCents(
    projection.refundsMinor,
    -projection.cashRefundsMinor,
  );
  return freezeV2({
    grossSalesMinor: projection.grossSalesMinor,
    discountsMinor: projection.discountsMinor,
    refundsMinor: projection.refundsMinor,
    netSalesMinor: addCents(
      projection.grossSalesMinor,
      -projection.discountsMinor,
      -projection.refundsMinor,
    ),
    netCashSalesMinor,
    netManualDigitalMinor: addCents(
      projection.manualDigitalMinor,
      -digitalRefunds,
    ),
    expectedCashMinor: addCents(
      projection.openingCashMinor,
      netCashSalesMinor,
      projection.cashPaidInMinor,
      -projection.cashPaidOutMinor,
    ),
    stockAtoms: { ...projection.stockAtoms },
  });
}
function countStock(
  snapshot: V2Snapshot,
  counts: readonly V2Count[],
  opening: boolean,
): Record<string, number> {
  if (
    counts.length !== snapshot.items.length ||
    new Set(counts.map((count) => count.itemId)).size !== counts.length
  )
    throw new V2Error("INCOMPLETE_COUNTS");
  const stock: Record<string, number> = {};
  for (const count of counts) {
    if (!snapshot.items.some((item) => item.id === count.itemId))
      throw new V2Error("UNKNOWN_ITEM");
    if (opening && count.kind === "uncounted")
      throw new V2Error("UNCOUNTED_OPENING");
    if (count.kind === "counted") stock[count.itemId] = count.atoms;
    else if (count.kind === "not-brought") stock[count.itemId] = 0;
  }
  return stock;
}
function changeStock(
  projection: V2Projection,
  deltas: Record<string, number>,
  multiplier: 1 | -1,
): void {
  for (const [itemId, atoms] of Object.entries(deltas)) {
    if (!Object.hasOwn(projection.stockAtoms, itemId))
      throw new V2Error("UNKNOWN_ITEM");
    const next = addCents(
      projection.stockAtoms[itemId]!,
      multiplyV2(atoms, multiplier),
    );
    if (next < 0) throw new V2Error("INSUFFICIENT_STOCK");
    projection.stockAtoms[itemId] = next;
  }
}
function orderFor(projection: V2Projection, saleId: string): V2Order {
  const order = projection.orders[saleId];
  if (!order) throw new V2Error("UNKNOWN_SALE");
  return order;
}
function lineKey(line: V2Line): string {
  return canonicalV2({
    productId: line.productId,
    modifierIds: [...line.modifierIds].sort(),
  });
}
function assertRemake(order: V2Order, lines: readonly V2Line[]): void {
  if (order.returned || order.prepState === "cancelled")
    throw new V2Error("CANCELLED_REMAKE");
  const available = new Map<string, number>();
  for (const line of order.lines)
    available.set(
      lineKey(line),
      addCents(available.get(lineKey(line)) ?? 0, line.quantity),
    );
  for (const line of lines) {
    const key = lineKey(line);
    const remaining = addCents(available.get(key) ?? 0, -line.quantity);
    if (remaining < 0) throw new V2Error("REMAKE_EXCEEDS_ORIGINAL");
    available.set(key, remaining);
  }
}
/** Inputs are trusted adapter context + untrusted envelope; a digest is not authorization. */
export async function applyV2Operation(
  snapshot: V2Snapshot,
  projection: V2Projection,
  operation: V2Operation,
  actor: V2Actor,
  hash: V2Hash,
): Promise<V2Projection> {
  const verifiedSnapshot = await verifyV2Snapshot(snapshot, hash);
  const verified = await verifyV2Operation(operation, hash);
  assertActor(verifiedSnapshot, actor);
  assertProjection(verifiedSnapshot, projection, actor);
  if (
    verified.businessId !== actor.businessId ||
    verified.shiftId !== actor.shiftId ||
    verified.installationId !== actor.installationId ||
    verified.authorityEpoch !== actor.authorityEpoch ||
    verified.snapshotId !== verifiedSnapshot.id ||
    verified.snapshotHash !== verifiedSnapshot.hash ||
    !actor.allowedKinds.includes(verified.kind)
  )
    throw new V2Error("UNAUTHORIZED_OPERATION");
  const canonical = canonicalV2(operationBodyV2(verified));
  const prior = projection.seen[verified.operationId];
  if (prior) {
    if (
      prior.digest !== verified.canonicalDigest ||
      prior.canonical !== canonical ||
      prior.sequence !== verified.sequence
    )
      throw new V2Error("OPERATION_CONFLICT");
    return freezeV2(cloneV2(projection));
  }
  if (projection.state === "closed") throw new V2Error("SHIFT_CLOSED");
  if (verified.sequence !== addCents(projection.lastSequence, 1))
    throw new V2Error("SEQUENCE_GAP");
  if ((projection.state === "unopened") !== (verified.kind === "OPEN_SHIFT"))
    throw new V2Error("SHIFT_STATE");
  const next = cloneV2(projection);
  switch (verified.kind) {
    case "OPEN_SHIFT": {
      next.stockAtoms = countStock(
        verifiedSnapshot,
        verified.payload.counts,
        true,
      );
      next.openingCashMinor = verified.payload.openingCashMinor;
      next.state = "open";
      break;
    }
    case "SALE": {
      const payload = verified.payload;
      if (Object.hasOwn(next.orders, payload.saleId))
        throw new V2Error("SALE_CONFLICT");
      const { consumption, subtotalMinor, itemQuantity } = consumeV2Lines(
        verifiedSnapshot,
        payload.lines,
      );
      if (payload.discountMinor > subtotalMinor)
        throw new V2Error("EXCESS_DISCOUNT");
      const totalMinor = addCents(subtotalMinor, -payload.discountMinor);
      let cashMinor = 0;
      let digitalMinor = 0;
      for (const tender of payload.tenders) {
        if (
          tender.changeMinor > tender.tenderedMinor ||
          (tender.method !== "cash" && tender.changeMinor !== 0)
        )
          throw new V2Error("INVALID_CHANGE");
        const retained = addCents(tender.tenderedMinor, -tender.changeMinor);
        if (tender.method === "cash") cashMinor = addCents(cashMinor, retained);
        else digitalMinor = addCents(digitalMinor, retained);
      }
      if (addCents(cashMinor, digitalMinor) !== totalMinor)
        throw new V2Error("TENDER_MISMATCH");
      changeStock(next, consumption, -1);
      next.orders[payload.saleId] = {
        saleId: payload.saleId,
        lines: cloneV2(payload.lines),
        totalMinor,
        cashMinor,
        digitalMinor,
        refundedCashMinor: 0,
        refundedDigitalMinor: 0,
        consumption,
        prepState: "new",
        returned: false,
      };
      next.grossSalesMinor = addCents(next.grossSalesMinor, subtotalMinor);
      next.discountsMinor = addCents(
        next.discountsMinor,
        payload.discountMinor,
      );
      next.retainedCashSalesMinor = addCents(
        next.retainedCashSalesMinor,
        cashMinor,
      );
      next.manualDigitalMinor = addCents(next.manualDigitalMinor, digitalMinor);
      next.paidOrderCount = addCents(next.paidOrderCount, 1);
      next.paidItemQuantity = addCents(next.paidItemQuantity, itemQuantity);
      break;
    }
    case "REFUND": {
      const payload = verified.payload;
      const order = orderFor(next, payload.saleId);
      const available =
        payload.method === "cash"
          ? addCents(order.cashMinor, -order.refundedCashMinor)
          : addCents(order.digitalMinor, -order.refundedDigitalMinor);
      if (payload.amountMinor > available)
        throw new V2Error("REFUND_EXCEEDS_TENDER");
      if (payload.method === "cash") {
        if (payload.amountMinor > summaryV2(next).expectedCashMinor)
          throw new V2Error("INSUFFICIENT_CASH");
        order.refundedCashMinor = addCents(
          order.refundedCashMinor,
          payload.amountMinor,
        );
        next.cashRefundsMinor = addCents(
          next.cashRefundsMinor,
          payload.amountMinor,
        );
      } else
        order.refundedDigitalMinor = addCents(
          order.refundedDigitalMinor,
          payload.amountMinor,
        );
      next.refundsMinor = addCents(next.refundsMinor, payload.amountMinor);
      break;
    }
    case "COMPLIMENTARY":
    case "REMAKE": {
      if (verified.kind === "REMAKE")
        assertRemake(
          orderFor(next, verified.payload.saleId),
          verified.payload.lines,
        );
      const { consumption, itemQuantity } = consumeV2Lines(
        verifiedSnapshot,
        verified.payload.lines,
      );
      changeStock(next, consumption, -1);
      if (verified.kind === "REMAKE")
        next.remadeItemQuantity = addCents(
          next.remadeItemQuantity,
          itemQuantity,
        );
      else
        next.complimentaryItemQuantity = addCents(
          next.complimentaryItemQuantity,
          itemQuantity,
        );
      break;
    }
    case "RESTOCK":
      changeStock(
        next,
        { [verified.payload.itemId]: verified.payload.atoms },
        1,
      );
      break;
    case "WASTE":
      changeStock(
        next,
        { [verified.payload.itemId]: verified.payload.atoms },
        -1,
      );
      break;
    case "ADJUST_STOCK": {
      const payload = verified.payload;
      if (
        !actor.verifiedStockApprovals?.some(
          (approval) =>
            approval.approvalId === payload.approvalId &&
            approval.operationId === verified.operationId &&
            approval.itemId === payload.itemId &&
            approval.deltaAtoms === payload.deltaAtoms,
        )
      )
        throw new V2Error("STOCK_APPROVAL_REQUIRED");
      changeStock(next, { [payload.itemId]: payload.deltaAtoms }, 1);
      break;
    }
    case "CASH_ADJUSTMENT": {
      const payload = verified.payload;
      if (payload.direction === "in")
        next.cashPaidInMinor = addCents(
          next.cashPaidInMinor,
          payload.amountMinor,
        );
      else {
        if (payload.amountMinor > summaryV2(next).expectedCashMinor)
          throw new V2Error("INSUFFICIENT_CASH");
        next.cashPaidOutMinor = addCents(
          next.cashPaidOutMinor,
          payload.amountMinor,
        );
      }
      break;
    }
    case "PREP_TRANSITION": {
      const payload = verified.payload;
      if (payload.prepInstallationId === actor.cashierInstallationId)
        throw new V2Error("INVALID_PREP_INSTALLATION");
      if (
        !actor.verifiedPrepCommands?.some(
          (command) =>
            command.commandId === payload.commandId &&
            command.saleId === payload.saleId &&
            command.prepInstallationId === payload.prepInstallationId &&
            command.action === payload.next,
        )
      )
        throw new V2Error("PREP_CONFIRMATION_REQUIRED");
      const command = canonicalV2({ kind: verified.kind, payload });
      const previous = next.prepCommands[payload.commandId];
      if (previous) {
        if (previous !== command) throw new V2Error("PREP_COMMAND_CONFLICT");
        break;
      }
      const order = orderFor(next, payload.saleId);
      if (!(
        (order.prepState === "new" && payload.next === "making") ||
        (order.prepState === "making" && payload.next === "done")
      ))
        throw new V2Error("PREP_TRANSITION");
      order.prepState = payload.next;
      next.prepCommands[payload.commandId] = command;
      break;
    }
    case "RETURN_UNPREPARED": {
      const payload = verified.payload;
      const confirmation = actor.verifiedPrepCommands?.find(
        (command) =>
          command.commandId === payload.prepCommandId &&
          command.saleId === payload.saleId &&
          command.action === "unprepared-return",
      );
      if (
        !confirmation ||
        confirmation.prepInstallationId === actor.cashierInstallationId
      )
        throw new V2Error("PREP_CONFIRMATION_REQUIRED");
      v2IdSchema.parse(confirmation.prepInstallationId);
      const command = canonicalV2({ kind: verified.kind, payload });
      const previous = next.prepCommands[payload.prepCommandId];
      if (previous) {
        if (previous !== command) throw new V2Error("PREP_COMMAND_CONFLICT");
        break;
      }
      const order = orderFor(next, payload.saleId);
      if (order.prepState !== "new" || order.returned)
        throw new V2Error("ORDER_ALREADY_PREPARED");
      changeStock(next, order.consumption, 1);
      order.returned = true;
      order.prepState = "cancelled";
      next.prepCommands[payload.prepCommandId] = command;
      break;
    }
    case "CLOSE_SHIFT": {
      const payload = verified.payload;
      if (
        payload.lastFinancialSequence !== verified.sequence - 1 ||
        payload.lastFinancialSequence !== projection.lastSequence ||
        payload.journalDigest !== (await journalDigestV2(projection, hash))
      )
        throw new V2Error("CLOSE_JOURNAL_MISMATCH");
      const summary = summaryV2(projection);
      if (
        payload.expectedCashMinor !== summary.expectedCashMinor ||
        payload.netSalesMinor !== summary.netSalesMinor ||
        canonicalV2(payload.expectedStockAtoms) !==
          canonicalV2(summary.stockAtoms)
      )
        throw new V2Error("CLOSE_BALANCE_MISMATCH");
      countStock(verifiedSnapshot, payload.counts, false);
      const unresolved = Object.values(next.orders)
        .filter(
          (order) => order.prepState === "new" || order.prepState === "making",
        )
        .map((order) => order.saleId)
        .sort();
      const resolutions = payload.manualResolutions
        .map((resolution) => resolution.saleId)
        .sort();
      if (canonicalV2(unresolved) !== canonicalV2(resolutions))
        throw new V2Error("UNRESOLVED_ORDERS");
      next.closing = cloneV2(payload);
      next.state = "closed";
      break;
    }
  }
  next.lastSequence = verified.sequence;
  next.seen[verified.operationId] = {
    digest: verified.canonicalDigest,
    canonical,
    sequence: verified.sequence,
  };
  return freezeV2(next);
}
