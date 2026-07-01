export const rolePermissionMatrix = {
  owner: [
    "business.manage",
    "reports.view",
    "shift.approve",
    "inventory.adjust",
  ],
  admin: [
    "employees.manage",
    "reports.view",
    "shift.approve",
    "inventory.adjust",
  ],
  operator: ["pos.use", "shift.start", "shift.close", "production.log"],
  employee: ["schedule.view", "shift.join", "inventory.count"],
} as const;

export const publicRuleModules = [
  "permissions",
  "shift-lifecycle",
  "inventory-ledger",
  "cash-reconciliation",
  "profit",
] as const;
