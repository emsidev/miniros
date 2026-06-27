import { pgEnum } from "drizzle-orm/pg-core";

export const businessStatusEnum = pgEnum("business_status", ["active", "suspended", "closed"]);
export const memberRoleEnum = pgEnum("member_role", ["owner", "admin", "operator", "employee"]);
export const memberStatusEnum = pgEnum("member_status", ["pending", "active", "rejected", "disabled"]);
export const employeeStatusEnum = pgEnum("employee_status", ["active", "inactive", "deleted"]);

export const productStatusEnum = pgEnum("product_status", ["active", "inactive", "deleted"]);
export const inventoryItemTypeEnum = pgEnum("inventory_item_type", [
  "raw_good",
  "consumable",
  "non_consumable",
  "finished_good",
  "packaging"
]);

export const locationTypeEnum = pgEnum("location_type", [
  "booth",
  "bazaar",
  "kiosk",
  "pop_up",
  "mall_booth",
  "event",
  "other"
]);

export const shiftStatusEnum = pgEnum("shift_status", ["scheduled", "active", "closing", "closed", "cancelled"]);
export const shiftAssignmentRoleEnum = pgEnum("shift_assignment_role", ["operator", "employee", "manager"]);
export const shiftAssignmentStatusEnum = pgEnum("shift_assignment_status", ["assigned", "confirmed", "cancelled", "completed"]);
export const shiftCostTypeEnum = pgEnum("shift_cost_type", ["rent", "transport", "other"]);

export const inventoryLocationTypeEnum = pgEnum("inventory_location_type", ["central", "selling_location", "shift"]);
export const inventoryEventTypeEnum = pgEnum("inventory_event_type", [
  "opening_count",
  "closeout_count",
  "sale_deduction",
  "production_input",
  "production_output",
  "adjustment",
  "receiving",
  "transfer_in",
  "transfer_out"
]);
export const inventoryCountTypeEnum = pgEnum("inventory_count_type", ["opening", "closing"]);

export const saleStatusEnum = pgEnum("sale_status", ["draft", "completed", "voided", "partially_refunded", "refunded"]);
export const paymentMethodEnum = pgEnum("payment_method", ["cash", "gcash", "maya", "card", "bank_transfer", "other"]);
export const paymentStatusEnum = pgEnum("payment_status", ["pending", "completed", "failed", "refunded"]);
export const fileTypeEnum = pgEnum("file_type", ["payment_proof", "product_image", "profile_image", "other"]);

export const requestStatusEnum = pgEnum("request_status", ["pending", "approved", "rejected", "cancelled"]);
export const saleChangeRequestTypeEnum = pgEnum("sale_change_request_type", ["void", "refund", "correction"]);
export const inventoryAdjustmentStatusEnum = pgEnum("inventory_adjustment_status", ["pending", "approved", "rejected", "applied", "cancelled"]);

export const closeoutStatusEnum = pgEnum("closeout_status", ["draft", "submitted", "approved", "rejected"]);
export const profitResultEnum = pgEnum("profit_result", ["profit", "break_even", "loss"]);

export const offlineActionTypeEnum = pgEnum("offline_action_type", [
  "START_SHIFT",
  "CREATE_SALE",
  "UPLOAD_PAYMENT_PROOF",
  "CREATE_PRODUCTION_LOG",
  "CREATE_CASH_DEDUCTION",
  "CREATE_INVENTORY_ADJUSTMENT",
  "SUBMIT_CLOSEOUT",
  "RECEIVE_STOCK",
  "TRANSFER_STOCK"
]);
export const offlineActionStatusEnum = pgEnum("offline_action_status", ["pending", "processing", "synced", "failed", "ignored"]);

export const stockTransferStatusEnum = pgEnum("stock_transfer_status", ["draft", "completed", "cancelled"]);
export const discountTypeEnum = pgEnum("discount_type", ["fixed_amount", "percentage"]);
export const promoStatusEnum = pgEnum("promo_status", ["active", "inactive", "expired"]);
