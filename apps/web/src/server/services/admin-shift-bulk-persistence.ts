import { randomUUID } from "node:crypto";
import {
  employees,
  sellingLocations,
  shiftAssignments,
  shiftCosts,
  shifts,
} from "@miniros/db/schema";
import { and, eq, inArray, notInArray, sql } from "drizzle-orm";
import {
  planningTotals,
  type BulkShiftInput,
  type ShiftAssignmentInput,
} from "@/lib/shift-planning";
import {
  validateAssignments,
  validateLocation,
  type ShiftTransaction,
} from "./admin-shift-persistence";
import { ShiftPlanningError } from "./shift-planning-error";

export async function validateBulkPlans(
  tx: ShiftTransaction,
  businessId: string,
  rows: Array<typeof shifts.$inferSelect>,
  input: BulkShiftInput,
) {
  const shiftIds = rows.map((row) => row.id);
  const locations = await tx
    .select()
    .from(sellingLocations)
    .where(
      and(
        eq(sellingLocations.businessId, businessId),
        inArray(sellingLocations.id, [
          ...new Set(rows.map((row) => row.sellingLocationId)),
        ]),
      ),
    )
    .orderBy(sellingLocations.id)
    .for("share");
  const storedTeam =
    input.operation === "team"
      ? []
      : await tx
          .select()
          .from(shiftAssignments)
          .where(
            and(
              eq(shiftAssignments.businessId, businessId),
              inArray(shiftAssignments.shiftId, shiftIds),
              notInArray(shiftAssignments.status, ["cancelled"]),
            ),
          );
  const employeeIds = [
    ...new Set(
      (input.operation === "team" ? input.assignments! : storedTeam).map(
        (member) => member.employeeId,
      ),
    ),
  ];
  const people = employeeIds.length
    ? await tx
        .select()
        .from(employees)
        .where(
          and(
            eq(employees.businessId, businessId),
            inArray(employees.id, employeeIds),
          ),
        )
        .orderBy(employees.id)
        .for("share")
    : [];
  const costs = await tx
    .select()
    .from(shiftCosts)
    .where(
      and(
        eq(shiftCosts.businessId, businessId),
        inArray(shiftCosts.shiftId, shiftIds),
      ),
    );
  const locationById = new Map(
    locations.map((location) => [location.id, location]),
  );
  const peopleById = new Map(people.map((person) => [person.id, person]));
  const errors: Record<string, string[]> = {};
  for (const shift of rows) {
    const publishing =
      input.operation === "publish" || shift.status === "scheduled";
    const team =
      input.operation === "team"
        ? input.assignments!
        : storedTeam.filter((member) => member.shiftId === shift.id);
    try {
      validateLocation(locationById.get(shift.sellingLocationId), publishing);
      validateAssignments(team, peopleById, publishing);
      try {
        planningTotals(
          team,
          costs.filter((cost) => cost.shiftId === shift.id),
        );
      } catch {
        throw new ShiftPlanningError("The combined planned cost is too large.");
      }
    } catch (error) {
      if (!(error instanceof ShiftPlanningError)) throw error;
      if (input.operation === "team")
        Object.assign(
          errors,
          Object.fromEntries(
            Object.entries(error.fieldErrors).filter(([field]) =>
              field.startsWith("assignments"),
            ),
          ),
        );
      errors[`shifts.${shift.id}`] = [
        `${shift.title || "Shift"} (${shift.shiftDate}): ${error.message}`,
      ];
    }
  }
  if (Object.keys(errors).length)
    throw new ShiftPlanningError(
      "Some shifts are not ready. Review the affected dates and team members below.",
      errors,
    );
}

export async function replaceBulkAssignments(
  tx: ShiftTransaction,
  businessId: string,
  rows: Array<typeof shifts.$inferSelect>,
  team: ShiftAssignmentInput[],
) {
  const selectedEmployees = team.map((member) => member.employeeId);
  await tx
    .update(shiftAssignments)
    .set({ status: "cancelled", updatedAt: new Date() })
    .where(
      and(
        eq(shiftAssignments.businessId, businessId),
        inArray(
          shiftAssignments.shiftId,
          rows.map((row) => row.id),
        ),
        selectedEmployees.length
          ? notInArray(shiftAssignments.employeeId, selectedEmployees)
          : undefined,
      ),
    );
  const assignments = rows.flatMap((shift) =>
    team.map((member) => ({
      ...member,
      id: randomUUID(),
      businessId,
      shiftId: shift.id,
      status:
        shift.status === "draft" ? ("draft" as const) : ("assigned" as const),
    })),
  );
  for (let index = 0; index < assignments.length; index += 500) {
    const chunk = assignments.slice(index, index + 500);
    const saved = await tx
      .insert(shiftAssignments)
      .values(chunk)
      .onConflictDoUpdate({
        target: [shiftAssignments.shiftId, shiftAssignments.employeeId],
        set: {
          roleOnShift: sql`excluded.role_on_shift`,
          salaryRateCents: sql`excluded.salary_rate_cents`,
          status: sql`case when ${shiftAssignments.status} = 'confirmed' and excluded.status = 'assigned' then 'confirmed'::public.shift_assignment_status else excluded.status end`,
          updatedAt: new Date(),
        },
        setWhere: eq(shiftAssignments.businessId, businessId),
      })
      .returning({ id: shiftAssignments.id });
    if (saved.length !== chunk.length)
      throw new ShiftPlanningError(
        "An assignment is unavailable. Reload the selected shifts before continuing.",
      );
  }
}
