export const paymentMethods = [
  "cash",
  "gcash",
  "maya",
  "bank_transfer",
  "card",
  "other",
] as const;
export type PaymentMethod = (typeof paymentMethods)[number];

export const shiftStatuses = [
  "scheduled",
  "active",
  "closing",
  "closed",
  "cancelled",
] as const;
export type ShiftStatus = (typeof shiftStatuses)[number];

export const memberRoles = ["owner", "admin", "operator", "employee"] as const;
export type MemberRole = (typeof memberRoles)[number];

export const employeePermissions = ["canUsePos", "canLogProduction"] as const;
export type EmployeePermission = (typeof employeePermissions)[number];

export const locationTypes = [
  "booth",
  "bazaar",
  "kiosk",
  "pop_up",
  "mall_booth",
  "event",
  "other",
] as const;
export type LocationType = (typeof locationTypes)[number];

export const inventoryItemTypes = [
  "raw_good",
  "consumable",
  "non_consumable",
  "finished_good",
  "packaging",
] as const;
export type InventoryItemType = (typeof inventoryItemTypes)[number];

export const approvalStatuses = [
  "pending",
  "approved",
  "rejected",
  "cancelled",
] as const;
export type ApprovalStatus = (typeof approvalStatuses)[number];

export const profitResults = ["profit", "break_even", "loss"] as const;
export type ProfitResult = (typeof profitResults)[number];
