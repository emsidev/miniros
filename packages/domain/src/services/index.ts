export const serviceModules = [
  "audit",
  "closeouts",
  "inventory",
  "offline",
  "pos",
  "production",
  "profit",
  "shifts",
] as const;

export const serviceModuleDescriptions: Record<
  (typeof serviceModules)[number],
  string
> = {
  audit: "Writes audit log records around workflow mutations.",
  closeouts: "Handles shift closeout and cash reconciliation workflows.",
  inventory: "Owns inventory ledger events and balances.",
  offline: "Processes offline sync actions idempotently.",
  pos: "Finalizes sales, payments, and receipt-side effects.",
  production: "Logs production and recipe consumption.",
  profit: "Calculates location and shift profitability snapshots.",
  shifts: "Starts, monitors, and closes selling shifts.",
};
