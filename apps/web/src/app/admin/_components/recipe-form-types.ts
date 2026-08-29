export type ProductOption = {
  id: string;
  name: string;
};

export type InventoryItemOption = {
  id: string;
  name: string;
  unit: string;
};

export type SavedRecipeLine = {
  id: string;
  inventoryItemId: string;
  quantity: string;
  unit: string;
};

export type EditableRecipeLine = SavedRecipeLine & {
  key: string;
};
