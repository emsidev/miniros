import type { PaymentMethod } from "@miniros/contracts";

export type PosProduct = {
  id: string;
  name: string;
  categoryName: string | null;
  priceCents: number;
  requiresRecipeDeduction: boolean;
  stockTracked: boolean;
  availableQuantity: number | null;
  stockRequirements: readonly {
    inventoryItemId: string;
    quantityPerUnit: string;
  }[];
};

export type PosPromo = {
  requiresPhoto?: boolean;
  id: string;
  name: string;
  discountType: "fixed_amount" | "percentage";
  discountValue: number;
};

export type PaymentDraft = {
  id: string;
  proofFileId: string;
  method: PaymentMethod;
  amount: string;
  amountMode: "exact" | "manual";
  reference: string;
  file: File | null;
};

export type SubmittedPayment = PaymentDraft & { amountCents: number };

export type DiscountPhoto = { fileId: string; file: File | null };

export type SaleReceipt = {
  discountName?: string;
  discountPhoto?: DiscountPhoto;
  pendingDiscountProof?: boolean;
  savedLocally?: boolean;
  saleId: string;
  totalCents: number;
  amountPaidCents: number;
  changeCents: number;
  payments: readonly SubmittedPayment[];
  pendingProofs: readonly SubmittedPayment[];
};
