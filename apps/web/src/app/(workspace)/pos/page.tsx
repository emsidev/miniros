import { PageHeader } from "@/components/shared/layout";
import { getPosWorkspace } from "@/server/services/operator-workspaces";
import { PosForm } from "./pos-form";

export const dynamic = "force-dynamic";

export default async function PosPage({
  searchParams,
}: {
  searchParams: Promise<{ shift?: string }>;
}) {
  const { shift } = await searchParams;
  const workspace = await getPosWorkspace(shift);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Point of sale"
        description={`${workspace.shift.locationName} · Complete sales, proofs, and recipe deductions together.`}
      />
      <PosForm shiftId={workspace.shift.id} products={workspace.products} />
    </div>
  );
}
