import type { LocationType } from "@miniros/contracts";

export type LocationRecord = {
  id: string;
  name: string;
  locationType: LocationType;
  address: string | null;
  notes: string | null;
  defaultRentalCostCents: number;
  defaultTransportCostCents: number;
  status: "active" | "inactive" | "deleted";
};
