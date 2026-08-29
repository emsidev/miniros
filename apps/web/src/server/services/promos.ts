import { randomUUID } from "node:crypto";
import { requireDatabase } from "@miniros/db";
import { auditLogs, promoRules } from "@miniros/db/schema";
import { and, asc, eq } from "drizzle-orm";
import { AccessError, requireActiveBusiness } from "./access";

export type PromoWriteInput = {
  name: string;
  discountType: "fixed_amount" | "percentage";
  discountValue: number;
  startsAt: string | null;
  endsAt: string | null;
};

export type PromoRecord = {
  id: string;
  name: string;
  discountType: "fixed_amount" | "percentage";
  discountValue: number;
  startsAt: string | null;
  endsAt: string | null;
  status: "active" | "inactive" | "expired";
};

function parseDate(value: string | null, endOfDay = false) {
  if (!value) return null;
  return new Date(`${value}T${endOfDay ? "23:59:59" : "00:00:00"}+08:00`);
}

function toPromoRecord(row: typeof promoRules.$inferSelect): PromoRecord {
  const now = Date.now();
  const endsAt = row.endsAt?.getTime();
  const status =
    row.status === "active" && endsAt !== undefined && endsAt < now
      ? "expired"
      : row.status;

  return {
    id: row.id,
    name: row.name,
    discountType: row.discountType,
    discountValue: Number(row.discountValue),
    startsAt: row.startsAt?.toISOString() ?? null,
    endsAt: row.endsAt?.toISOString() ?? null,
    status,
  };
}

function validateWindow(input: PromoWriteInput) {
  const startsAt = parseDate(input.startsAt);
  const endsAt = parseDate(input.endsAt, true);
  if (startsAt && Number.isNaN(startsAt.getTime())) {
    throw new AccessError("Enter a valid promo start date.");
  }
  if (endsAt && Number.isNaN(endsAt.getTime())) {
    throw new AccessError("Enter a valid promo end date.");
  }
  if (startsAt && endsAt && endsAt < startsAt) {
    throw new AccessError("The promo end date must be after its start date.");
  }
  return { startsAt, endsAt };
}

export async function listPromos() {
  const { business } = await requireActiveBusiness({ admin: true });
  const rows = await requireDatabase()
    .select()
    .from(promoRules)
    .where(eq(promoRules.businessId, business.id))
    .orderBy(asc(promoRules.name));
  return rows.map(toPromoRecord);
}

export async function createPromo(input: PromoWriteInput) {
  const access = await requireActiveBusiness({ admin: true });
  const { startsAt, endsAt } = validateWindow(input);
  const database = requireDatabase();
  const id = randomUUID();

  const created = await database.transaction(async (tx) => {
    const [record] = await tx
      .insert(promoRules)
      .values({
        id,
        businessId: access.business.id,
        name: input.name.trim(),
        discountType: input.discountType,
        discountValue: input.discountValue.toFixed(2),
        startsAt,
        endsAt,
        status: "active",
      })
      .returning();
    if (!record) throw new Error("Promo was not created.");

    await tx.insert(auditLogs).values({
      id: randomUUID(),
      businessId: access.business.id,
      actorUserId: access.user.id,
      actorEmployeeId: access.employee?.id ?? null,
      action: "promo.created",
      entityType: "promo_rule",
      entityId: id,
      metadata: {
        name: record.name,
        discountType: record.discountType,
        discountValue: record.discountValue,
      },
    });
    return record;
  });

  return toPromoRecord(created);
}

export async function setPromoStatus(
  promoId: string,
  status: "active" | "inactive",
) {
  const access = await requireActiveBusiness({ admin: true });
  const database = requireDatabase();
  const updated = await database.transaction(async (tx) => {
    const [record] = await tx
      .update(promoRules)
      .set({ status, updatedAt: new Date() })
      .where(
        and(
          eq(promoRules.id, promoId),
          eq(promoRules.businessId, access.business.id),
        ),
      )
      .returning();

    if (!record) throw new AccessError("Promo not found.");
    await tx.insert(auditLogs).values({
      id: randomUUID(),
      businessId: access.business.id,
      actorUserId: access.user.id,
      actorEmployeeId: access.employee?.id ?? null,
      action: "promo.status_updated",
      entityType: "promo_rule",
      entityId: promoId,
      metadata: { status },
    });
    return record;
  });
  return toPromoRecord(updated);
}
