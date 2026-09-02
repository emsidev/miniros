import Link from "next/link";
import { ArrowRight, Boxes, CookingPot, Truck } from "lucide-react";
import { PageHeader } from "@/components/shared/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireActiveBusiness } from "@/server/services/access";

const inventoryAreas = [
  {
    href: "/admin/inventory/items",
    title: "Inventory items",
    description: "Ingredients, consumables, packaging, and finished goods.",
    icon: Boxes,
  },
  {
    href: "/admin/inventory/recipes",
    title: "Product recipes",
    description: "Define what stock each sold product consumes.",
    icon: CookingPot,
  },
  {
    href: "/admin/inventory/stock",
    title: "Stock movements",
    description: "Receive supplies and transfer stock between locations.",
    icon: Truck,
  },
] as const;

export default async function InventoryPage() {
  const { business } = await requireActiveBusiness({ admin: true });
  const visibleAreas = inventoryAreas.filter(
    (area) =>
      area.href !== "/admin/inventory/recipes" ||
      business.features.recipesEnabled,
  );

  return (
    <>
      <PageHeader
        title="Inventory setup"
        description="Build the stock catalog first, then connect sellable products to recipes."
      />
      <div className="grid gap-4 sm:grid-cols-2">
        {visibleAreas.map(({ href, title, description, icon: Icon }) => (
          <Link key={href} href={href} className="group">
            <Card className="h-full rounded-xl py-5 shadow-none transition-colors group-hover:border-foreground/30">
              <CardHeader className="flex-row items-center gap-3 px-5">
                <span className="grid size-11 place-items-center rounded-xl bg-accent text-accent-foreground">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <CardTitle className="font-bold">{title}</CardTitle>
                <ArrowRight
                  className="ml-auto size-4 text-muted-foreground"
                  aria-hidden="true"
                />
              </CardHeader>
              <CardContent className="px-5 text-sm leading-relaxed text-muted-foreground">
                {description}
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </>
  );
}
