export type ProductOption = {
  id: string;
  name: string;
};

export type InventoryItemOption = {
  id: string;
  name: string;
  unit: string;
  defaultUnitCostCents: number;
};

export type SavedRecipeLine = {
  id: string;
  inventoryItemId: string;
  quantity: string;
  unit: string;
  unitCostCents: number;
};

export type EditableRecipeLine = SavedRecipeLine & {
  key: string;
};

export type RecipeEditorValue = {
  lines: SavedRecipeLine[];
  laborCostCents: number;
  overheadCostCents: number;
};
