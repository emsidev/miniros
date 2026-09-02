import Link from "next/link";
import { redirect } from "next/navigation";
import { BrandMark } from "@/components/shared/brand-mark";
import { EmptyState } from "@/components/shared/feedback";
import { Button } from "@/components/ui/button";
import {
  isProductionOnlyEmployee,
  requireActiveBusiness,
} from "@/server/services/access";
import {
  OperationalShiftUnavailableError,
  type OperationalShiftUnavailableReason,
} from "@/server/services/operator-workspace-core";
import { getPosWorkspace } from "@/server/services/operator-workspaces";
import { PosForm } from "./pos-form";
import { PosHeader } from "./pos-header";

export const dynamic = "force-dynamic";

function PosShiftUnavailableState({
  reason,
}: {
  reason: OperationalShiftUnavailableReason;
}) {
  const isRequestedShiftUnavailable = reason === "requested_shift_unavailable";

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-[var(--mi-color-ink)] text-white">
        <div className="mx-auto flex min-h-24 max-w-[1440px] items-center gap-3 px-4 sm:px-6 lg:px-8">
          <BrandMark variant="inverse" />
          <div>
            <p className="font-bold">MINIROS Point of Sale</p>
            <p className="text-sm text-white/65">Shift checkout workspace</p>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
        <EmptyState
          title={
            isRequestedShiftUnavailable
              ? "Shift unavailable"
              : "No active shift"
          }
          description={
            isRequestedShiftUnavailable
              ? "This shift is not active or is no longer available to you."
              : "Start an assigned shift before using the point of sale."
          }
          action={
            <Button asChild>
              <Link href="/shifts">View my shifts</Link>
            </Button>
          }
        />
      </main>
    </div>
  );
}

export default async function PosPage({
  searchParams,
}: {
  searchParams: Promise<{ shift?: string }>;
}) {
  const { employee } = await requireActiveBusiness();
  if (isProductionOnlyEmployee(employee)) redirect("/production");
  const { shift } = await searchParams;
  let workspace: Awaited<ReturnType<typeof getPosWorkspace>>;

  try {
    workspace = await getPosWorkspace(shift);
  } catch (error) {
    if (error instanceof OperationalShiftUnavailableError) {
      return <PosShiftUnavailableState reason={error.reason} />;
    }
    throw error;
  }

  return (
    <div>
      {workspace.products.length === 0 ? (
        <div className="min-h-screen bg-background">
          <PosHeader
            shiftId={workspace.shift.id}
            locationName={workspace.shift.locationName}
            saleCount={workspace.shiftSummary.saleCount}
            itemCount={workspace.shiftSummary.itemCount}
            salesCents={workspace.shiftSummary.salesCents}
            cartCount={0}
          />
          <main className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
            <EmptyState
              title="No products available"
              description="Ask an admin to add or activate a sellable product before taking sales."
              action={
                <Button asChild>
                  <Link href={`/shifts/${workspace.shift.id}`}>View shift</Link>
                </Button>
              }
            />
          </main>
        </div>
      ) : (
        <PosForm
          shiftId={workspace.shift.id}
          locationName={workspace.shift.locationName}
          shiftSummary={workspace.shiftSummary}
          inventoryBalances={workspace.inventoryBalances}
          products={workspace.products}
          promosEnabled={workspace.promosEnabled}
          promos={workspace.promos}
        />
      )}
    </div>
  );
}
