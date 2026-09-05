import type {
  LocationType,
  PaymentMethod,
  ProfitResult,
  ShiftStatus,
} from "@miniros/contracts/constants";
import { formatMoney as formatDomainMoney } from "@miniros/domain";
import { formatQuantity as formatDomainQuantity } from "@miniros/domain";

const paymentMethodLabels: Record<PaymentMethod, string> = {
  bank_transfer: "Bank transfer",
  card: "Card",
  cash: "Cash",
  gcash: "GCash",
  maya: "Maya",
  other: "Other",
};

const shiftStatusLabels: Record<ShiftStatus, string> = {
  draft: "Draft",
  active: "Active",
  cancelled: "Cancelled",
  closed: "Closed",
  closing: "Closing",
  scheduled: "Scheduled",
};

const profitResultLabels: Record<ProfitResult, string> = {
  break_even: "Break even",
  loss: "Loss",
  profit: "Profit",
};

const locationTypeLabels: Record<LocationType, string> = {
  bazaar: "Bazaar",
  booth: "Booth",
  event: "Event",
  kiosk: "Kiosk",
  mall_booth: "Mall booth",
  other: "Other",
  pop_up: "Pop-up",
};

const dateFormatter = new Intl.DateTimeFormat("en-PH", {
  dateStyle: "medium",
  timeZone: "Asia/Manila",
});

const dateTimeFormatter = new Intl.DateTimeFormat("en-PH", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Manila",
});

function toDate(value: Date | number | string): Date {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new TypeError("A valid date is required.");
  }

  return date;
}

export const formatMoney = formatDomainMoney;
export const formatQuantity = formatDomainQuantity;
export const formatDate = (value: Date | number | string) =>
  dateFormatter.format(toDate(value));
export const formatDateTime = (value: Date | number | string) =>
  dateTimeFormatter.format(toDate(value));
export const formatPaymentMethod = (value: PaymentMethod) =>
  paymentMethodLabels[value];
export const formatShiftStatus = (value: ShiftStatus) =>
  shiftStatusLabels[value];
export const formatProfitResult = (value: ProfitResult) =>
  profitResultLabels[value];
export const formatLocationType = (value: LocationType) =>
  locationTypeLabels[value];
