import Link from "next/link";
import { SyncStatusButton } from "@/features/offline/device-controls";
import { ShiftNavigationScope } from "@/components/employee/navigation-context";
import { ArrowLeft, ShoppingCart } from "lucide-react";

import { BrandMark } from "@/components/shared/brand-mark";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/format";

export function PosHeader({
  shiftId,
  locationName,
  saleCount,
  itemCount,
  salesCents,
  cartCount,
  onOpenCart,
}: {
  shiftId: string;
  locationName: string;
  saleCount: number;
  itemCount: number;
  salesCents: number;
  cartCount: number;
  onOpenCart?: () => void;
}) {
  return (
    <header className="sticky top-0 z-[var(--mi-z-sticky)] bg-[var(--mi-color-ink)] text-white">
      <ShiftNavigationScope id={shiftId} status="active" />
      <div className="mx-auto flex min-h-24 max-w-[1440px] items-center gap-3 px-4 py-4 sm:px-6 lg:px-8">
        <Button
          asChild
          size="icon"
          variant="ghost"
          className="text-white hover:bg-white/10 hover:text-white"
        >
          <Link href={`/shifts/${shiftId}`} aria-label="Back to shift">
            <ArrowLeft aria-hidden="true" />
          </Link>
        </Button>
        <BrandMark variant="inverse" className="hidden sm:grid" />
        <div className="min-w-0 flex-1">
          <p className="break-words text-base font-bold sm:text-lg">
            {locationName}
          </p>
          <p className="mt-0.5 text-xs leading-relaxed text-white/80 sm:text-sm">
            Shift open · {saleCount} {saleCount === 1 ? "sale" : "sales"} ·{" "}
            {itemCount} {itemCount === 1 ? "unit" : "units"} ·{" "}
            {formatMoney(salesCents)} sold
          </p>
        </div>
        <SyncStatusButton inverse />
        {onOpenCart ? (
          <Button
            type="button"
            size="icon"
            onClick={onOpenCart}
            aria-label={`Open current order with ${cartCount} ${cartCount === 1 ? "item" : "items"}`}
            className="relative bg-[var(--mi-color-accent)] text-[var(--mi-color-ink)] hover:bg-[var(--mi-color-accent-hover)] lg:hidden"
          >
            <ShoppingCart aria-hidden="true" />
            {cartCount > 0 ? (
              <span className="absolute -top-1 -right-1 grid min-w-5 place-items-center rounded-full bg-white px-1 text-[11px] leading-5 font-extrabold text-[var(--mi-color-ink)]">
                {cartCount}
              </span>
            ) : null}
          </Button>
        ) : null}
        <Button
          asChild
          variant="outline"
          className="hidden border-white/25 bg-transparent text-white hover:bg-white/10 hover:text-white lg:inline-flex"
        >
          <Link href={`/shifts/${shiftId}`}>Back to shift</Link>
        </Button>
      </div>
    </header>
  );
}
