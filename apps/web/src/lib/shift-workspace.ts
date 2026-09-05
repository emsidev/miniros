import type { ShiftStatus } from "@miniros/contracts";
import { addDays, startOfWeek } from "date-fns";
import {
  fromDateKey,
  toDateKey,
} from "@/app/admin/_components/shift-date-utils";
import { isValidShiftDate } from "./shift-planning";

export type WorkspaceFilters = {
  q: string;
  location: string;
  employee: string;
  status: string;
  from: string;
  to: string;
  scope: "open" | "history";
  view: "agenda" | "calendar";
  date: string;
};
export function readWorkspaceFilters(
  params: URLSearchParams,
  today: string,
): WorkspaceFilters {
  const status = params.get("status") ?? "";
  return {
    q: params.get("q") ?? "",
    location: params.get("location") ?? "",
    employee: params.get("employee") ?? "",
    status: [
      "draft",
      "scheduled",
      "active",
      "closing",
      "closed",
      "cancelled",
    ].includes(status)
      ? status
      : "",
    from: isValidShiftDate(params.get("from") ?? "") ? params.get("from")! : "",
    to: isValidShiftDate(params.get("to") ?? "") ? params.get("to")! : "",
    scope: params.get("scope") === "history" ? "history" : "open",
    view: params.get("view") === "calendar" ? "calendar" : "agenda",
    date: isValidShiftDate(params.get("date") ?? "")
      ? params.get("date")!
      : today,
  };
}
export function weekDates(date: string) {
  const start = startOfWeek(fromDateKey(date)!, { weekStartsOn: 1 });
  return Array.from({ length: 7 }, (_, index) =>
    toDateKey(addDays(start, index)),
  );
}
export function filterWorkspaceShifts<
  T extends {
    title: string | null;
    locationName: string;
    sellingLocationId: string;
    status: ShiftStatus;
    shiftDate: string;
    assignments: Array<{
      employeeId: string;
      employeeName: string;
      status: string;
    }>;
  },
>(shifts: T[], filters: WorkspaceFilters) {
  const query = filters.q.trim().toLocaleLowerCase();
  return shifts
    .filter((shift) => {
      const history = shift.status === "closed" || shift.status === "cancelled";
      const team = shift.assignments.filter(
        (item) => shift.status === "cancelled" || item.status !== "cancelled",
      );
      return (
        (filters.scope === "history" ? history : !history) &&
        (!filters.status || shift.status === filters.status) &&
        (!filters.location || shift.sellingLocationId === filters.location) &&
        (!filters.employee ||
          team.some((item) => item.employeeId === filters.employee)) &&
        (!filters.from || shift.shiftDate >= filters.from) &&
        (!filters.to || shift.shiftDate <= filters.to) &&
        (!query ||
          [
            shift.title,
            shift.locationName,
            ...team.map((item) => item.employeeName),
          ].some((text) => text?.toLocaleLowerCase().includes(query)))
      );
    })
    .sort((a, b) => {
      if (filters.scope === "history")
        return (
          b.shiftDate.localeCompare(a.shiftDate) ||
          a.locationName.localeCompare(b.locationName)
        );
      const live = (status: string) =>
        status === "active" || status === "closing" ? 0 : 1;
      return (
        live(a.status) - live(b.status) ||
        a.shiftDate.localeCompare(b.shiftDate) ||
        a.locationName.localeCompare(b.locationName)
      );
    });
}
