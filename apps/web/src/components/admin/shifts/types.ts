import type { listAdminShifts } from "@/server/services/admin-shifts";
import type { getShiftSetupOptions } from "@/server/services/shift-setup-options";
export type AdminShift = Awaited<ReturnType<typeof listAdminShifts>>[number];
export type ShiftSetupOptions = Awaited<
  ReturnType<typeof getShiftSetupOptions>
>;
export type PlanningEmployee = ShiftSetupOptions["employees"][number];
export type PlanningLocation = ShiftSetupOptions["locations"][number];
export type TeamMember = {
  employeeId: string;
  roleOnShift: "operator" | "employee" | "manager";
  salary: string;
};
export type CostLine = {
  key: string;
  id?: string;
  costType: "rent" | "transport" | "other";
  label: string;
  amount: string;
  notes: string | null;
};
