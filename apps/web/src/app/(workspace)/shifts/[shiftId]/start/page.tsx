import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { EmptyState } from "@/components/shared/feedback";
import { PageHeader } from "@/components/shared/layout";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";
import { getStartShiftWorkspace } from "@/server/services/operator-workspaces";
import { StartShiftForm } from "./start-shift-form";

export const dynamic = "force-dynamic";

export default async function StartShiftPage({
  params,
}: {
  params: Promise<{ shiftId: string }>;
}) {
  const { shiftId } = await params;
  const workspace = await getStartShiftWorkspace(shiftId);

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" className="-ml-2">
        <Link href={`/shifts/${shiftId}`}>
          <ArrowLeft aria-hidden="true" /> Back to shift
        </Link>
      </Button>
      <PageHeader
        title="Start shift"
        description={`${workspace.shift.locationName} · ${formatDate(workspace.shift.shiftDate)}`}
      />
      {workspace.items.length === 0 ? (
        <EmptyState
          title="No inventory items to count"
          description="Ask an admin to add tracked inventory items before this shift starts."
        />
      ) : (
        <StartShiftForm shiftId={shiftId} items={workspace.items} />
      )}
    </div>
  );
}
