"use server";

import { actionSuccess, locationTypes } from "@miniros/contracts";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  createLocation,
  listLocations,
  softDeleteLocation,
  updateLocation,
} from "../services/locations";
import { actionError } from "./helpers";

const centsSchema = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);

const locationWriteSchema = z.object({
  name: z.string().trim().min(2).max(120),
  locationType: z.enum(locationTypes),
  address: z.string().trim().max(500).nullable().optional().default(null),
  notes: z.string().trim().max(2_000).nullable().optional().default(null),
  defaultRentalCostCents: centsSchema.default(0),
  defaultTransportCostCents: centsSchema.default(0),
  status: z.enum(["active", "inactive"]).default("active"),
});

const updateLocationSchema = locationWriteSchema.extend({
  locationId: z.string().uuid(),
});
const locationIdSchema = z.object({ locationId: z.string().uuid() });
const emptyInputSchema = z.object({}).strict();

export async function listLocationsAction(input: unknown = {}) {
  try {
    emptyInputSchema.parse(input);
    return actionSuccess(await listLocations());
  } catch (error) {
    return actionError(error);
  }
}

export async function createLocationAction(input: unknown) {
  try {
    const values = locationWriteSchema.parse(input);
    const result = await createLocation(values);
    revalidatePath("/admin/locations");
    revalidatePath("/admin/shifts");
    return actionSuccess(result);
  } catch (error) {
    return actionError(error);
  }
}

export async function updateLocationAction(input: unknown) {
  try {
    const { locationId, ...values } = updateLocationSchema.parse(input);
    const result = await updateLocation(locationId, values);
    revalidatePath("/admin/locations");
    revalidatePath("/admin/shifts");
    return actionSuccess(result);
  } catch (error) {
    return actionError(error);
  }
}

export async function softDeleteLocationAction(input: unknown) {
  try {
    const { locationId } = locationIdSchema.parse(input);
    const result = await softDeleteLocation(locationId);
    revalidatePath("/admin/locations");
    revalidatePath("/admin/shifts");
    return actionSuccess(result);
  } catch (error) {
    return actionError(error);
  }
}
