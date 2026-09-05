import { AdminTable } from "@/components/shared/admin-table";
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import Link from "next/link";
import { ArrowRight, Boxes, CookingPot, Truck } from "lucide-react";
import { PageHeader } from "@/components/shared/layout";
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
      <AdminTable label="Inventory setup">
        <TableHeader>
          <TableRow>
            <TableHead scope="col">Area</TableHead>
            <TableHead scope="col">Description</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {visibleAreas.map(({ href, title, description, icon: Icon }) => (
            <TableRow key={href}>
              <TableCell>
                <Link
                  href={href}
                  className="inline-flex min-h-11 items-center gap-3 font-semibold underline-offset-4 hover:underline"
                >
                  <Icon
                    className="size-4 shrink-0 text-muted-foreground"
                    aria-hidden="true"
                  />
                  {title}
                  <ArrowRight className="size-4 shrink-0" aria-hidden="true" />
                </Link>
              </TableCell>
              <TableCell className="min-w-64 whitespace-normal text-muted-foreground">
                {description}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </AdminTable>
    </>
  );
}
