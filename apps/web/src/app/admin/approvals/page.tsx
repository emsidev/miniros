import { EmptyState } from "@/components/shared/feedback";
import {
  DataCard,
  PageHeader,
  SectionHeader,
} from "@/components/shared/layout";
import { formatDateTime, formatMoney, formatQuantity } from "@/lib/format";
import { listPendingApprovals } from "@/server/services/approval-read";
import { ApprovalActions } from "./approval-actions";

export const dynamic = "force-dynamic";

export default async function ApprovalsPage() {
  const approvals = await listPendingApprovals();
  const empty = approvals.cash.length === 0 && approvals.inventory.length === 0;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Approvals"
        description="Review cash deductions and inventory changes before they affect closeout and stock."
      />
      {empty ? (
        <EmptyState
          title="No pending approvals"
          description="New operator requests will appear here."
        />
      ) : null}
      {approvals.cash.length > 0 ? (
        <section>
          <SectionHeader title="Cash deductions" />
          <div className="grid gap-3 lg:grid-cols-2">
            {approvals.cash.map((request) => (
              <DataCard key={request.id} className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-extrabold">{request.label}</p>
                    <p className="text-sm text-muted-foreground">
                      {request.locationName} ·{" "}
                      {request.requestedByName ?? "Team member"}
                    </p>
                  </div>
                  <strong>{formatMoney(request.amountCents)}</strong>
                </div>
                <p className="text-sm">
                  {request.reason || "No additional reason."}
                </p>
                <p className="text-xs text-muted-foreground">
                  Requested {formatDateTime(request.createdAt)}
                </p>
                <ApprovalActions id={request.id} type="cash" />
              </DataCard>
            ))}
          </div>
        </section>
      ) : null}
      {approvals.inventory.length > 0 ? (
        <section>
          <SectionHeader title="Inventory adjustments" />
          <div className="grid gap-3 lg:grid-cols-2">
            {approvals.inventory.map((request) => (
              <DataCard key={request.id} className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-extrabold">{request.itemName}</p>
                    <p className="text-sm text-muted-foreground">
                      {request.locationName} ·{" "}
                      {request.requestedByName ?? "Team member"}
                    </p>
                  </div>
                  <strong>
                    {Number(request.quantityDelta) > 0 ? "+" : ""}
                    {formatQuantity(request.quantityDelta)} {request.unit}
                  </strong>
                </div>
                <p className="text-sm">{request.reason}</p>
                <p className="text-xs text-muted-foreground">
                  Requested {formatDateTime(request.createdAt)}
                </p>
                <ApprovalActions id={request.id} type="inventory" />
              </DataCard>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
