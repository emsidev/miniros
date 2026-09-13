/** EP01 conceptual contract only. Not a production grant verifier or v1 wire upgrade. */
export const staffWorkflowStates = [
  "scheduled",
  "prepared",
  "packing",
  "departure-ready",
  "opening-count",
  "open",
  "closing-draft",
  "closed-locally",
  "cancelled",
] as const;
export type StaffWorkflowState = (typeof staffWorkflowStates)[number];
export type CountAnswer = Readonly<
  | { kind: "uncounted" }
  | { kind: "counted"; quantity: number }
  | { kind: "not-brought" }
>;
export type ChecklistAnswer = Readonly<{
  kind: "unchecked" | "packed" | "missing" | "authorized-exception";
  actorId?: string;
  at?: string;
  templateVersion: string;
  reason?: string;
}>;
export type CloudCompleteness = Readonly<
  | { kind: "not-received" | "receiving" }
  | { kind: "in-sync"; throughSequence: number }
  | {
      kind: "gap-or-conflict";
      throughSequence: number;
      missing: readonly number[];
    }
  | { kind: "final-received"; throughSequence: number; manifestId: string }
>;
export type OwnerReview = "not-reviewed" | "needs-review" | "reviewed";
export type PrepOrderState = "new" | "making" | "done" | "cancelled";
export type StaffWorkflow = Readonly<{
  state: StaffWorkflowState;
  cashierInstallationId: string;
  authorityEpoch: number;
  openingSealed: boolean;
}>;
export type WorkflowGuard = Readonly<{
  installationId: string;
  authorityEpoch: number;
  snapshotReady?: boolean;
  checklistResolved?: boolean;
  counts?: readonly CountAnswer[];
  openingReviewed?: boolean;
  closeReviewed?: boolean;
  prepResolved?: boolean;
}>;
export const staffTransitions: Readonly<
  Record<StaffWorkflowState, readonly StaffWorkflowState[]>
> = {
  scheduled: ["prepared", "cancelled"],
  prepared: ["packing"],
  packing: ["departure-ready"],
  "departure-ready": ["opening-count"],
  "opening-count": ["open"],
  open: ["closing-draft"],
  "closing-draft": ["open", "closed-locally"],
  "closed-locally": [],
  cancelled: [],
};
/** Conceptual serialized claim reducer. EP05 supplies the actual atomic transaction. */
export function claimCashier(
  current: string | undefined,
  installationId: string,
): string {
  if (
    !installationId.trim() ||
    (current !== undefined && current !== installationId)
  )
    throw new Error("A different cashier already owns this shift.");
  return installationId;
}
function assertWorkflowInvariant(workflow: StaffWorkflow) {
  const mustBeSealed = ["open", "closing-draft", "closed-locally"].includes(
    workflow.state,
  );
  if (mustBeSealed !== workflow.openingSealed)
    throw new Error("Invalid opening seal state.");
}
export function assertCashier(
  workflow: StaffWorkflow,
  guard: Pick<WorkflowGuard, "installationId" | "authorityEpoch">,
): void {
  if (
    !workflow.cashierInstallationId ||
    guard.installationId !== workflow.cashierInstallationId ||
    !Number.isSafeInteger(workflow.authorityEpoch) ||
    workflow.authorityEpoch < 1 ||
    guard.authorityEpoch !== workflow.authorityEpoch
  )
    throw new Error(
      "Only the assigned cashier in this authority epoch may write.",
    );
}
export function validateCount(answer: CountAnswer): CountAnswer {
  if (
    answer.kind === "counted" &&
    (!Number.isFinite(answer.quantity) || answer.quantity < 0)
  )
    throw new Error("Enter a finite, non-negative quantity.");
  return answer;
}
export function countFromText(text: string): CountAnswer {
  if (!text.trim()) return { kind: "uncounted" };
  if (!/^\d+(?:\.\d+)?$/.test(text.trim()))
    throw new Error("Enter a non-negative quantity.");
  return validateCount({ kind: "counted", quantity: Number(text) });
}
export function editOpeningCount(
  workflow: StaffWorkflow,
  guard: WorkflowGuard,
  answer: CountAnswer,
): CountAnswer {
  assertWorkflowInvariant(workflow);
  assertCashier(workflow, guard);
  if (workflow.openingSealed || workflow.state !== "opening-count")
    throw new Error(
      "Opening counts are sealed or not yet available. Use an audited adjustment after opening.",
    );
  return validateCount(answer);
}
export function transitionStaff(
  workflow: StaffWorkflow,
  next: StaffWorkflowState,
  guard: WorkflowGuard,
): StaffWorkflow {
  assertWorkflowInvariant(workflow);
  assertCashier(workflow, guard);
  if (!staffTransitions[workflow.state].includes(next))
    throw new Error("Illegal workflow transition.");
  if (next === "prepared" && !guard.snapshotReady)
    throw new Error("Prepare the automatic snapshot while connected first.");
  if (next === "departure-ready" && !guard.checklistResolved)
    throw new Error("Resolve missing supplies before departure.");
  if (next === "open" && workflow.state === "opening-count") {
    if (
      !guard.counts?.length ||
      guard.counts.some((c) => validateCount(c).kind === "uncounted") ||
      !guard.openingReviewed
    )
      throw new Error("Resolve and review every opening count.");
  }
  if (
    next === "closed-locally" &&
    (!guard.closeReviewed || !guard.prepResolved)
  )
    throw new Error("Review closing counts and resolve prep orders.");
  return {
    ...workflow,
    state: next,
    openingSealed: workflow.openingSealed || next === "open",
  };
}
export function transitionPrep(
  current: PrepOrderState,
  next: PrepOrderState,
  explicitResolution = false,
): PrepOrderState {
  if (current === next) return current;
  if (
    (current === "new" && next === "making") ||
    (current === "making" && next === "done")
  )
    return next;
  if (
    next === "cancelled" &&
    current !== "done" &&
    current !== "cancelled" &&
    explicitResolution
  )
    return next;
  throw new Error(
    "Prep transition requires a valid forward action or audited resolution.",
  );
}
export type OwnerScheduleDraft = Readonly<{
  date: string;
  openingTime: string;
  closingTime: string;
  venue: string;
  address: string;
  cashierId: string;
  prepId: string;
}>;
export function validateOwnerSchedule(draft: OwnerScheduleDraft): void {
  if (Object.values(draft).some((value) => !value.trim()))
    throw new Error(
      "Complete date, planned times, venue, address and staff assignments.",
    );
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(draft.date) ||
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(draft.openingTime) ||
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(draft.closingTime)
  )
    throw new Error("Use a valid date and planned times.");
  if (
    new Date(`${draft.date}T00:00:00Z`).toISOString().slice(0, 10) !==
    draft.date
  )
    throw new Error("Use a valid date.");
  if (draft.openingTime === draft.closingTime)
    throw new Error("Planned opening and closing times must differ.");
  if (draft.cashierId === draft.prepId)
    throw new Error("Assign one cashier and a different prep staff member.");
}
/** Proposal version is deliberately not accepted by the existing schemaVersion:1 parser. */
export type V2OperationProposal<Payload = unknown> = Readonly<{
  protocolVersion: 2;
  schemaVersion: 2;
  businessId: string;
  shiftId: string;
  snapshotId: string;
  snapshotHash: string;
  installationId: string;
  authorityEpoch: number;
  operationId: string;
  sequence: number;
  kind: string;
  occurredAt: string;
  payload: Payload;
  canonicalDigest: string;
  authenticity: Readonly<{ scheme: string; evidence: string }>;
}>;
export type DeliveryReceipt = Readonly<{
  operationId: string;
  destination: "peer" | "cloud";
  receivedAt: string;
  outcome: "committed" | "duplicate" | "conflict";
}>;
export type AttachmentJob = Readonly<{
  operationId: string;
  fileId: string;
  state: "pending" | "uploaded" | "needs-review";
}>;
