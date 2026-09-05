import { listEmployees } from "./employees";
import { listLocations } from "./locations";
import type { getAdminShift } from "./admin-shifts";

export async function getShiftSetupOptions(
  shift?: Awaited<ReturnType<typeof getAdminShift>>,
) {
  const [locations, employees] = await Promise.all([
    listLocations(),
    listEmployees(),
  ]);
  const locationOptions = locations.map((item) => ({
    id: item.id,
    name: item.name,
    defaultRentalCostCents: item.defaultRentalCostCents,
    defaultTransportCostCents: item.defaultTransportCostCents,
    available: item.status === "active",
  }));
  const employeeOptions = employees.map((item) => ({
    id: item.id,
    displayName: item.displayName,
    defaultShiftRateCents: item.defaultShiftRateCents,
    canUsePos: item.canUsePos,
    available: item.status === "active",
  }));
  if (
    shift &&
    !locationOptions.some((item) => item.id === shift.sellingLocationId)
  )
    locationOptions.push({
      id: shift.sellingLocationId,
      name: shift.locationName,
      defaultRentalCostCents: shift.rentalCostCents,
      defaultTransportCostCents: shift.transportCostCents,
      available: false,
    });
  shift?.assignments.forEach((assignment) => {
    if (
      !employeeOptions.some((employee) => employee.id === assignment.employeeId)
    )
      employeeOptions.push({
        id: assignment.employeeId,
        displayName: assignment.employeeName,
        defaultShiftRateCents: assignment.salaryRateCents,
        canUsePos: false,
        available: false,
      });
  });
  return { locations: locationOptions, employees: employeeOptions };
}
