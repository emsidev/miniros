export const workflowIds = [
  "start-shift",
  "finalize-sale",
  "upload-payment-proof",
  "log-production",
  "approve-inventory-adjustment",
  "submit-closeout",
  "calculate-shift-profit",
  "sync-offline-action",
] as const;

export type WorkflowId = (typeof workflowIds)[number];

export type WorkflowDefinition = {
  id: WorkflowId;
  label: string;
  owner: string;
  ruleModules: string[];
  nextSurface: "api" | "web" | "mobile";
};

export const workflowCatalog: WorkflowDefinition[] = [
  {
    id: "start-shift",
    label: "Start shift",
    owner: "shift operations",
    ruleModules: ["permissions", "shift-lifecycle", "inventory-counts"],
    nextSurface: "api",
  },
  {
    id: "finalize-sale",
    label: "Finalize sale",
    owner: "pos",
    ruleModules: ["permissions", "payments", "sales"],
    nextSurface: "api",
  },
  {
    id: "upload-payment-proof",
    label: "Upload payment proof",
    owner: "payments",
    ruleModules: ["permissions", "storage", "sales"],
    nextSurface: "api",
  },
  {
    id: "log-production",
    label: "Log production",
    owner: "production",
    ruleModules: ["permissions", "recipes", "inventory-ledger"],
    nextSurface: "api",
  },
  {
    id: "approve-inventory-adjustment",
    label: "Approve inventory adjustment",
    owner: "inventory",
    ruleModules: ["permissions", "approvals", "inventory-ledger"],
    nextSurface: "api",
  },
  {
    id: "submit-closeout",
    label: "Submit closeout",
    owner: "closeouts",
    ruleModules: ["permissions", "cash-reconciliation", "shift-lifecycle"],
    nextSurface: "api",
  },
  {
    id: "calculate-shift-profit",
    label: "Calculate shift profit",
    owner: "profit",
    ruleModules: ["profit", "snapshots", "shift-costs"],
    nextSurface: "api",
  },
  {
    id: "sync-offline-action",
    label: "Sync offline action",
    owner: "offline",
    ruleModules: ["offline-sync", "idempotency", "conflict-review"],
    nextSurface: "api",
  },
];
