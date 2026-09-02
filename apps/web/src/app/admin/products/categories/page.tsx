import Link from "next/link";
import { Tags } from "lucide-react";
import { PageHeader } from "@/components/shared/layout";
import { Button } from "@/components/ui/button";
import { listProductCategories } from "@/server/services/product-categories";
import { ProductCategoryManager } from "../../_components/product-category-manager";

export const dynamic = "force-dynamic";

export default async function ProductCategoriesPage() {
  const categories = await listProductCategories();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Product categories"
        description="Organize the products your team sells and the POS uses for browsing."
        action={
          <Button asChild variant="outline" className="h-11 rounded-xl">
            <Link href="/admin/products">
              <Tags aria-hidden="true" /> View products
            </Link>
          </Button>
        }
      />
      <ProductCategoryManager categories={categories} />
    </div>
  );
}
