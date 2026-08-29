export const memberRoles = ["owner", "admin", "operator", "employee"] as const;
export type MemberRole = (typeof memberRoles)[number];

export const adminMemberRoles = ["owner", "admin"] as const;
export type AdminMemberRole = (typeof adminMemberRoles)[number];

export const operationalPermissions = [
  "pos.use",
  "shift.start",
  "shift.close",
  "production.log",
] as const;
export type OperationalPermission = (typeof operationalPermissions)[number];

export type EmployeePermissionFlags = Readonly<{
  canLogProduction: boolean;
  canUsePos: boolean;
}>;

export function isAdminMemberRole(
  role: MemberRole | null | undefined,
): role is AdminMemberRole {
  return role === "owner" || role === "admin";
}

export function hasAdminAccess(role: MemberRole | null | undefined): boolean {
  return isAdminMemberRole(role);
}

export function hasOperationalPermission(
  flags: EmployeePermissionFlags | null | undefined,
  permission: OperationalPermission,
): boolean {
  if (!flags) {
    return false;
  }

  switch (permission) {
    case "pos.use":
    case "shift.start":
    case "shift.close":
      return flags.canUsePos === true;
    case "production.log":
      return flags.canLogProduction === true;
    default:
      return false;
  }
}

export function getOperationalPermissions(
  flags: EmployeePermissionFlags | null | undefined,
): OperationalPermission[] {
  return operationalPermissions.filter((permission) =>
    hasOperationalPermission(flags, permission),
  );
}

export const publicRuleModules = [
  "permissions",
  "shift-lifecycle",
  "inventory-ledger",
  "cash-reconciliation",
  "profit",
] as const;
