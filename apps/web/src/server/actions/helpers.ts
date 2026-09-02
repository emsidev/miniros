import { actionFailure, type ActionResult } from "@miniros/contracts";
import { ZodError } from "zod";
import { AccessError } from "../services/access";

export function actionError(error: unknown): ActionResult<never> {
  if (error instanceof ZodError) {
    const fieldErrors = Object.fromEntries(
      Object.entries(error.flatten().fieldErrors).filter(
        (entry): entry is [string, string[]] => entry[1] !== undefined,
      ),
    );

    return actionFailure(
      "Check the highlighted fields and try again.",
      fieldErrors,
    );
  }

  if (error instanceof AccessError) {
    return actionFailure(error.message);
  }

  console.error(error);
  return actionFailure("Something went wrong. Please try again.");
}
