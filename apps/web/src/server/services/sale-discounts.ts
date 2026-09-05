import { promoRules } from "@miniros/db/schema";
import { addCents, percentageOfCents } from "@miniros/domain";
import { and, eq } from "drizzle-orm";
import { AccessError } from "./access";
import type { PreparedOperationContext } from "./offline-context";
import type { OperationalTransaction } from "./operational-helpers";
import type { FinalizeSaleInput } from "./sale-calculations";

export async function validateSaleDiscount(
  tx: OperationalTransaction,
  businessId: string,
  input: FinalizeSaleInput,
  subtotalCents: number,
  prepared?: PreparedOperationContext,
) {
  if (!input.discount) return undefined;
  const promo = prepared
    ? prepared.snapshot.promos.find((p) => p.id === input.discount!.promoId)
    : (
        await tx
          .select()
          .from(promoRules)
          .where(
            and(
              eq(promoRules.id, input.discount.promoId),
              eq(promoRules.businessId, businessId),
              eq(promoRules.status, "active"),
            ),
          )
          .limit(1)
      )[0];
  if (!promo?.requiresPhoto)
    throw new AccessError("The selected photo-required promo is unavailable.");
  if (
    "startsAt" in promo &&
    ((promo.startsAt && promo.startsAt > new Date()) ||
      (promo.endsAt && promo.endsAt < new Date()))
  )
    throw new AccessError("The selected promo is outside its active dates.");
  const expected = Math.min(
    subtotalCents,
    promo.discountType === "fixed_amount"
      ? Math.round(Number(promo.discountValue) * 100)
      : percentageOfCents(subtotalCents, Number(promo.discountValue)),
  );
  if (expected !== addCents(...input.items.map((i) => i.discountCents ?? 0)))
    throw new AccessError(
      "The promo amount has changed. Select it again before charging.",
    );
  return promo;
}
