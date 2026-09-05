import { AccessError } from "./access-error";

export class ShiftPlanningError extends AccessError {
  constructor(
    message: string,
    public readonly fieldErrors: Record<string, string[]> = {},
  ) {
    super(message);
  }
}
