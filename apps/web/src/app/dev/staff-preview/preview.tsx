"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { emptyShiftProjection } from "@miniros/contracts";
import { EmployeeShellFrame } from "@/components/shared/employee-shell-frame";
import { ShiftCountWorkflow } from "@/components/employee/shift-count-workflow";
import { SavedShiftOverview } from "@/features/offline/device-workspace";
import { ShiftContext } from "@/components/employee/shift-context";
import { PosForm } from "@/app/(workspace)/pos/pos-form";
import { ShiftStore, type LocalSession } from "@/lib/offline/store";
import type { ClosingDraft } from "@/lib/offline/count-draft";
import type { OpeningDraft } from "@/lib/offline/opening-draft";
import { Button } from "@/components/ui/button";
const id = (n: number) =>
  "10000000-0000-4000-8000-" + n.toString().padStart(12, "0");
const shiftId = id(1);
const names = [
  "Classic milk tea",
  "Matcha latte",
  "Brown sugar milk",
  "Wintermelon tea",
  "Iced coffee",
  "Taro milk tea",
  "Lemon tea",
  "Chocolate milk",
  "Bottled water",
  "Strawberry latte",
  "Oat latte",
  "Mango iced tea",
];
export function StaffPreview() {
  const db = useMemo(() => new ShiftStore("miniros-staff-preview"), []);
  const [path, setPath] = useState("/shifts/" + shiftId);
  const [draft, setDraft] = useState<OpeningDraft>();
  const [error, setError] = useState("");
  const products = useMemo(
    () =>
      names.map((name, i) => ({
        id: id(20 + i),
        name,
        categoryName:
          i === 8 ? "Water" : i === 4 || i === 10 ? "Coffee" : "Drinks",
        priceCents:
          i === 8 ? 3000 : i % 3 === 0 ? 10000 : i % 3 === 1 ? 12000 : 11000,
        requiresRecipeDeduction: false,
        stockTracked: true,
        availableQuantity: i === 6 ? 0 : 20,
        stockRequirements: [
          { inventoryItemId: id(40 + i), quantityPerUnit: "1" },
        ],
      })),
    [],
  );
  const session: LocalSession = useMemo(
    () => ({
      id: id(2),
      deviceId: "synthetic-preview",
      status: "active",
      acknowledgedSequence: 5,
      nextSequence: 6,
      lastError: null,
      snapshot: {
        schemaVersion: 2,
        id: id(3),
        storageInstallationId: id(4),
        businessId: id(5),
        userId: id(6),
        employeeId: id(7),
        inventoryLocationId: id(8),
        businessName: "MINIROS preview",
        shiftId,
        locationName: "Saturday Market Hall",
        shiftDate: "2026-09-12",
        preparedAt: "2026-09-12T01:00:00Z",
        features: {
          recipesEnabled: false,
          approvalsEnabled: false,
          promosEnabled: false,
        },
        products: products.map((p, i) => ({
          ...p,
          costCents: 4000,
          stockInventoryItemId: id(40 + i),
          producedInventoryItemId: null,
        })),
        inventory: products.map((p, i) => ({
          id: id(40 + i),
          name: p.name,
          unit: "pcs",
          defaultUnitCostCents: 4000,
        })),
        recipes: [],
        promos: [],
        costs: {
          rentCents: 10000,
          transportCents: 2000,
          salaryCents: 5000,
          otherCents: 0,
        },
      },
      projection: {
        ...emptyShiftProjection(),
        state: "active",
        balances: Object.fromEntries(
          products.map((p, i) => [id(40 + i), i === 6 ? "0" : "20"]),
        ),
        salesCents: 40000,
        deductionsCents: 3000,
        saleCount: 4,
        openingCashCents: 50000,
      },
    }),
    [products],
  );
  useEffect(() => {
    void db.drafts
      .get(path.endsWith("/close") ? "preview:close" : "preview:counts")
      .then((row) =>
        setDraft(
          (row?.value as OpeningDraft | undefined) ?? {
            counts: {},
            cash: "",
            notes: "",
            step: 0,
            actionId: id(80),
            openingEventId: id(81),
          },
        ),
      );
  }, [db, path]);
  const persist = useCallback(
    async (next: OpeningDraft) => {
      await db.drafts.put({
        id: path.endsWith("/close") ? "preview:close" : "preview:counts",
        value: next,
      });
    },
    [db, path],
  );
  const navigate = (href: string) => {
    setError("");
    setPath(href.split("?")[0]);
    window.scrollTo(0, 0);
  };
  return (
    <EmployeeShellFrame
      workspaceHome={"/shifts/" + shiftId}
      businessControl={<span>MINIROS preview</span>}
      route={{
        pathname: path,
        shift: { id: shiftId, status: "active" },
        identityKey: "staff-preview",
        onNavigate: navigate,
      }}
      employeePermissions={{ canUsePos: true, canLogProduction: false }}
    >
      <p className="border-b px-4 py-2 text-xs text-muted-foreground">
        Synthetic preview · isolated drafts · no uploads
      </p>
      {path === "/pos" ? (
        <PosForm
          developmentPreview
          shiftId={shiftId}
          draftOwnerKey="preview"
          locationName={session.snapshot.locationName}
          shiftDate={session.snapshot.shiftDate}
          inventoryBalances={Object.entries(session.projection.balances).map(
            ([inventoryItemId, quantity]) => ({ inventoryItemId, quantity }),
          )}
          products={products}
          promosEnabled={false}
          promos={[]}
          onBack={() => navigate("/shifts/" + shiftId)}
        />
      ) : path.endsWith("/close") || path.endsWith("/start") ? (
        <div className="space-y-6">
          <ShiftContext
            title={path.endsWith("/close") ? "Close shift" : "Opening count"}
            shift={{
              id: shiftId,
              locationName: session.snapshot.locationName,
              shiftDate: session.snapshot.shiftDate,
              status: "active",
            }}
            onBack={() => navigate("/shifts/" + shiftId)}
            backHref={"/shifts/" + shiftId}
          />
          {draft && path.endsWith("/close") ? (
            <ShiftCountWorkflow
              key={path}
              shiftId={shiftId}
              mode="close"
              items={session.snapshot.inventory.map((item) => ({
                ...item,
                initialQuantity: session.projection.balances[item.id],
              }))}
              summary={{
                openingCashCents: 50000,
                saleSummary: { grossSalesCents: 40000, discountsCents: 0 },
                paymentSummary: [
                  { method: "cash", amountCents: 30000 },
                  { method: "gcash", amountCents: 10000 },
                ],
                approvedDeductionsCents: 3000,
              }}
              closeout={{
                draft: {
                  ...draft,
                  cashReconciliationId: id(82),
                  profitSummaryId: id(83),
                  inventoryEventId: id(84),
                } as ClosingDraft,
                onChange: persist,
                onSubmit: async () => {
                  throw new Error("Preview only. No closeout is committed.");
                },
              }}
            />
          ) : draft ? (
            <ShiftCountWorkflow
              key={path}
              shiftId={shiftId}
              mode="start"
              items={session.snapshot.inventory.map((item) => ({
                ...item,
                initialQuantity: "",
              }))}
              opening={{
                draft,
                onChange: persist,
                onSubmit: async () => {
                  throw new Error(
                    "Preview only. Counts are saved in an isolated browser database.",
                  );
                },
              }}
            />
          ) : (
            <p>Loading preview counts…</p>
          )}
        </div>
      ) : path === "/more" || path === "/inventory" ? (
        <section className="space-y-4 py-6">
          <h1 className="text-xl font-bold">
            {path === "/more" ? "More" : "Stock & expenses"}
          </h1>
          <p className="text-sm">
            Preview: account changes and financial tasks are disabled.
          </p>
          <Button
            variant="outline"
            onClick={() => navigate("/shifts/" + shiftId)}
          >
            Back to shift
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate("/shifts/" + shiftId + "/start")}
          >
            Preview blank opening count
          </Button>
        </section>
      ) : (
        <>
          <SavedShiftOverview session={session} onNavigate={navigate} />
          <Button
            className="mt-6"
            variant="outline"
            onClick={() => navigate("/shifts/" + shiftId + "/start")}
          >
            Preview opening count
          </Button>
        </>
      )}
      {error ? <p role="alert">{error}</p> : null}
    </EmployeeShellFrame>
  );
}
