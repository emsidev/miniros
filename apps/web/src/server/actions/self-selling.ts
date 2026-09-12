"use server";
import { revalidatePath } from "next/cache";
import { actionSuccess } from "@miniros/contracts";
import { enableMySellingAccess } from "../services/self-selling";
import { actionError } from "./helpers";
export async function enableMySellingAccessAction() {
  try {
    const result = await enableMySellingAccess();
    revalidatePath("/admin", "layout");
    revalidatePath("/shifts", "layout");
    return actionSuccess(result);
  } catch (error) {
    return actionError(error);
  }
}
