"use server";
import { z } from "zod";
import { actionSuccess } from "@miniros/contracts";
import { revalidatePath } from "next/cache";
import { actionError } from "./helpers";
import {
  recoverOfflineDevice,
  releasePreparedShift,
} from "../services/offline-admin";
export async function recoverOfflineDeviceAction(input: unknown) {
  try {
    const value = z
      .object({
        sessionId: z.string().uuid(),
        decision: z.enum(["freeze", "restore"]),
        reason: z.string().trim().min(10).max(2000),
      })
      .parse(input);
    const result = await recoverOfflineDevice(
      value.sessionId,
      value.decision,
      value.reason,
    );
    revalidatePath("/admin/devices");
    revalidatePath("/admin/shifts", "layout");
    revalidatePath("/shifts", "layout");
    return actionSuccess(result);
  } catch (error) {
    return actionError(error);
  }
}
export async function releasePreparedShiftAction(input: unknown) {
  try {
    const value = z
      .object({ sessionId: z.string().uuid(), storageId: z.string().uuid() })
      .parse(input);
    return actionSuccess(
      await releasePreparedShift(value.sessionId, value.storageId),
    );
  } catch (error) {
    return actionError(error);
  }
}
