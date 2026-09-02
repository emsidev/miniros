import type { InventoryItemType, InventoryUnit } from "@miniros/contracts";

export type InventoryItemRecord = {
  id: string;
  name: string;
  sku: string;
  itemType: InventoryItemType;
  unit: InventoryUnit;
  defaultUnitCostCents: number;
  trackStock: boolean;
  status: "active" | "inactive" | "deleted";
};

export type InventoryItemPreset = {
  itemType: InventoryItemType;
  label: string;
  pluralLabel: string;
  description: string;
  defaultUnit: InventoryUnit;
  defaultTrackStock: boolean;
};

export const inventoryItemPresets = [
  {
    itemType: "raw_good",
    label: "Ingredient",
    pluralLabel: "Ingredients",
    description: "Materials used to make or prepare what you sell.",
    defaultUnit: "kg",
    defaultTrackStock: true,
  },
  {
    itemType: "packaging",
    label: "Packaging",
    pluralLabel: "Packaging",
    description: "Cups, bags, labels, and other customer-facing packing.",
    defaultUnit: "pcs",
    defaultTrackStock: true,
  },
  {
    itemType: "consumable",
    label: "Supply",
    pluralLabel: "Supplies",
    description: "Operational supplies that are used up while selling.",
    defaultUnit: "pcs",
    defaultTrackStock: true,
  },
  {
    itemType: "non_consumable",
    label: "Equipment",
    pluralLabel: "Equipment",
    description:
      "Reusable tools and equipment you do not usually count as stock.",
    defaultUnit: "pcs",
    defaultTrackStock: false,
  },
  {
    itemType: "finished_good",
    label: "Finished product",
    pluralLabel: "Finished products",
    description: "Ready-to-sell stock prepared or purchased in advance.",
    defaultUnit: "pcs",
    defaultTrackStock: true,
  },
] as const satisfies readonly InventoryItemPreset[];

export function getInventoryItemPreset(itemType: InventoryItemType) {
  const preset = inventoryItemPresets.find(
    (candidate) => candidate.itemType === itemType,
  );

  if (!preset) {
    throw new Error(`Missing inventory-item preset for ${itemType}.`);
  }

  return preset;
}
