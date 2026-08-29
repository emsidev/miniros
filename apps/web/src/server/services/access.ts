import { requireDatabase } from "@miniros/db";
import {
  businessMembers,
  businesses,
  employees,
  shiftAssignments,
  shifts,
} from "@miniros/db/schema";
import type { User } from "@supabase/supabase-js";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { cookies } from "next/headers";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export const ACTIVE_BUSINESS_COOKIE = "miniros-active-business";

export class AccessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AccessError";
  }
}

export const requireUser = cache(async (): Promise<User> => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    throw new AccessError("Please sign in to continue.");
  }

  return data.user;
});

type AccessOptions = {
  admin?: boolean;
  employeePermission?: "pos" | "production";
  assignedShiftId?: string;
};

const getActiveBusinessAccess = cache(async () => {
  const user = await requireUser();
  const cookieStore = await cookies();
  const businessId = cookieStore.get(ACTIVE_BUSINESS_COOKIE)?.value;

  if (!businessId) {
    throw new AccessError("Select an active business to continue.");
  }

  const database = requireDatabase();
  const [membership] = await database
    .select({
      memberId: businessMembers.id,
      role: businessMembers.role,
      businessId: businesses.id,
      businessName: businesses.name,
    })
    .from(businessMembers)
    .innerJoin(businesses, eq(businessMembers.businessId, businesses.id))
    .where(
      and(
        eq(businessMembers.businessId, businessId),
        eq(businessMembers.authUserId, user.id),
        eq(businessMembers.status, "active"),
        isNull(businessMembers.deletedAt),
        eq(businesses.status, "active"),
        isNull(businesses.deletedAt),
      ),
    )
    .limit(1);

  if (!membership) {
    throw new AccessError("You do not have access to this business.");
  }

  const [employee] = await database
    .select({
      id: employees.id,
      canUsePos: employees.canUsePos,
      canLogProduction: employees.canLogProduction,
    })
    .from(employees)
    .where(
      and(
        eq(employees.businessId, businessId),
        eq(employees.memberId, membership.memberId),
        eq(employees.status, "active"),
        isNull(employees.deletedAt),
      ),
    )
    .limit(1);

  return {
    user,
    business: {
      id: membership.businessId,
      name: membership.businessName,
    },
    membership: {
      id: membership.memberId,
      role: membership.role,
    },
    employee: employee ?? null,
  };
});

export async function requireActiveBusiness(options: AccessOptions = {}) {
  const context = await getActiveBusinessAccess();

  if (
    options.admin &&
    context.membership.role !== "owner" &&
    context.membership.role !== "admin"
  ) {
    throw new AccessError("Owner or admin access is required.");
  }

  if (options.employeePermission === "pos" && !context.employee?.canUsePos) {
    throw new AccessError("POS permission is required.");
  }

  if (
    options.employeePermission === "production" &&
    !context.employee?.canLogProduction
  ) {
    throw new AccessError("Production permission is required.");
  }

  if (options.assignedShiftId) {
    if (!context.employee) {
      throw new AccessError("An active employee record is required.");
    }

    const [assignment] = await requireDatabase()
      .select({ id: shiftAssignments.id })
      .from(shiftAssignments)
      .innerJoin(
        shifts,
        and(
          eq(shiftAssignments.shiftId, shifts.id),
          eq(shiftAssignments.businessId, shifts.businessId),
        ),
      )
      .where(
        and(
          eq(shiftAssignments.businessId, context.business.id),
          eq(shiftAssignments.shiftId, options.assignedShiftId),
          eq(shiftAssignments.employeeId, context.employee.id),
          inArray(shiftAssignments.status, [
            "assigned",
            "confirmed",
            "completed",
          ]),
          eq(shifts.businessId, context.business.id),
          isNull(shifts.deletedAt),
        ),
      )
      .limit(1);

    if (!assignment) {
      throw new AccessError("You are not assigned to this shift.");
    }
  }

  return context;
}
