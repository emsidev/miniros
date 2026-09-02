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

export const inventoryUnitValues = [
  "pcs",
  "pack",
  "box",
  "bottle",
  "cup",
  "g",
  "kg",
  "ml",
  "l",
] as const;

export type InventoryUnit = (typeof inventoryUnitValues)[number];

export const inventoryUnits = [
  { value: "pcs", label: "Pieces (pcs)" },
  { value: "pack", label: "Packs" },
  { value: "box", label: "Boxes" },
  { value: "bottle", label: "Bottles" },
  { value: "cup", label: "Cups" },
  { value: "g", label: "Grams (g)" },
  { value: "kg", label: "Kilograms (kg)" },
  { value: "ml", label: "Milliliters (mL)" },
  { value: "l", label: "Liters (L)" },
] as const satisfies readonly { value: InventoryUnit; label: string }[];

export const defaultProductCategories = [
  { name: "Add ons", sortOrder: 0 },
  { name: "Drinks", sortOrder: 10 },
  { name: "Desserts", sortOrder: 20 },
] as const;

export const approvalStatuses = [
  "pending",
  "approved",
  "rejected",
  "cancelled",
] as const;
export type ApprovalStatus = (typeof approvalStatuses)[number];

export const profitResults = ["profit", "break_even", "loss"] as const;
export type ProfitResult = (typeof profitResults)[number];
