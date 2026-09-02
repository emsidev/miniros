import { Search, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { PosProduct } from "./pos-types";

export function PosCatalog({
  products,
  categories,
  search,
  category,
  cart,
  mobileSearchOpen,
  onSearchChange,
  onCategoryChange,
  onToggleMobileSearch,
  onAdd,
  getAvailability,
}: {
  products: readonly PosProduct[];
  categories: readonly string[];
  search: string;
  category: string;
  cart: Readonly<Record<string, number>>;
  mobileSearchOpen: boolean;
  onSearchChange: (value: string) => void;
  onCategoryChange: (value: string) => void;
  onToggleMobileSearch: () => void;
  onAdd: (product: PosProduct) => void;
  getAvailability: (productId: string) => number | null;
}) {
  return (
    <section aria-labelledby="catalog-title" className="min-w-0">
      <div className="mb-4 flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <h1 id="catalog-title" className="text-xl font-extrabold sm:text-2xl">
            Sell
          </h1>
          <p className="text-sm text-muted-foreground">
            Tap a product to add it to the current order.
          </p>
        </div>
        <Button
          type="button"
          size="icon"
          variant="outline"
          onClick={onToggleMobileSearch}
          className="lg:hidden"
          aria-label={
            mobileSearchOpen ? "Close product search" : "Search products"
          }
          aria-expanded={mobileSearchOpen}
        >
          {mobileSearchOpen ? (
            <X aria-hidden="true" />
          ) : (
            <Search aria-hidden="true" />
          )}
        </Button>
        <div className="relative hidden w-full max-w-sm lg:block">
          <Search
            aria-hidden="true"
            className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search products"
            className="pl-9"
          />
        </div>
      </div>

      {mobileSearchOpen ? (
        <div className="relative mb-3 lg:hidden">
          <Search
            aria-hidden="true"
            className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            autoFocus
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search products"
            className="h-12 pl-9"
          />
        </div>
      ) : null}

      <div
        className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0"
        aria-label="Product categories"
      >
        {["all", ...categories].map((value) => (
          <Button
            key={value}
            type="button"
            size="sm"
            variant={category === value ? "default" : "outline"}
            className={cn(
              "shrink-0 rounded-full",
              category === value &&
                "bg-[var(--mi-color-accent)] text-[var(--mi-color-ink)] hover:bg-[var(--mi-color-accent-hover)]",
            )}
            onClick={() => onCategoryChange(value)}
            aria-pressed={category === value}
          >
            {value === "all" ? "All" : value}
          </Button>
        ))}
      </div>

      {products.length === 0 ? (
        <div className="rounded-[var(--mi-radius-lg)] border border-dashed p-8 text-center">
          <p className="font-bold">No matching products</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Try another search or category.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
          {products.map((product) => {
            const quantity = cart[product.id] ?? 0;
            const availability = getAvailability(product.id);
            const soldOut = availability === 0;
            const atLimit = availability !== null && quantity >= availability;

            return (
              <button
                key={product.id}
                type="button"
                onClick={() => onAdd(product)}
                disabled={soldOut || atLimit}
                aria-label={`${product.name}, ${formatMoney(product.priceCents)}${soldOut ? ", sold out" : ""}`}
                className={cn(
                  "relative min-h-32 rounded-[var(--mi-radius-lg)] border bg-card p-4 text-left transition-[background-color,border-color] duration-[var(--mi-motion-fast)] ease-[var(--mi-motion-ease-out)] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none",
                  quantity > 0 && "border-foreground bg-muted/45",
                  !soldOut &&
                    !atLimit &&
                    "hover:border-foreground/35 active:bg-muted",
                  (soldOut || atLimit) && "cursor-not-allowed opacity-60",
                )}
              >
                {quantity > 0 ? (
                  <Badge className="absolute top-3 right-3 border-0 bg-foreground text-background">
                    {quantity}
                  </Badge>
                ) : null}
                <span className="ledger-nums block text-xl font-extrabold">
                  {formatMoney(product.priceCents)}
                </span>
                <span className="mt-3 block pr-7 text-sm leading-snug font-semibold">
                  {product.name}
                </span>
                <span
                  className={cn(
                    "mt-2 block text-xs font-semibold",
                    soldOut ? "text-destructive" : "text-muted-foreground",
                  )}
                >
                  {soldOut
                    ? "Sold out"
                    : availability === null
                      ? (product.categoryName ?? "Other")
                      : `${availability} available`}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
