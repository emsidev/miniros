import { Mail, Phone, UserRound } from "lucide-react";
import { EmptyState, StatusBadge } from "@/components/shared/feedback";
import { PageHeader } from "@/components/shared/layout";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoney } from "@/lib/format";
import { listEmployees } from "@/server/services/employees";
import { CreateEmployeeDialog } from "../_components/create-employee-dialog";

export const dynamic = "force-dynamic";

export default async function EmployeesPage() {
  const employees = await listEmployees();
  const createAction = <CreateEmployeeDialog />;

  return (
    <>
      <PageHeader
        title="Employees"
        description="Manage team access and default salary snapshots."
        action={employees.length > 0 ? createAction : undefined}
      />

      {employees.length === 0 ? (
        <EmptyState
          title="No employees yet"
          description="Add the team members who will sell, log production, or work assigned shifts."
          action={createAction}
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {employees.map((employee) => (
            <Card key={employee.id} className="rounded-2xl py-5 shadow-none">
              <CardHeader className="flex-row items-start gap-3 px-5">
                <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-muted">
                  <UserRound className="size-5" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <CardTitle className="truncate font-bold">
                    {employee.displayName}
                  </CardTitle>
                  <p className="mt-1 text-sm font-semibold">
                    {formatMoney(employee.defaultShiftRateCents)} per shift
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <StatusBadge status={employee.status} />
                  <CreateEmployeeDialog employee={employee} />
                </div>
              </CardHeader>
              <CardContent className="space-y-4 px-5">
                <div className="space-y-1.5 text-sm text-muted-foreground">
                  {employee.email ? (
                    <p className="flex items-center gap-2">
                      <Mail className="size-4" aria-hidden="true" />
                      <span className="truncate">{employee.email}</span>
                    </p>
                  ) : null}
                  {employee.phone ? (
                    <p className="flex items-center gap-2">
                      <Phone className="size-4" aria-hidden="true" />
                      <span>{employee.phone}</span>
                    </p>
                  ) : null}
                  {!employee.email && !employee.phone ? (
                    <p>No contact details</p>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  {employee.memberStatus === "pending" ? (
                    <Badge variant="outline">Invitation pending</Badge>
                  ) : null}
                  <Badge variant={employee.canUsePos ? "default" : "outline"}>
                    {employee.canUsePos ? "POS access" : "No POS access"}
                  </Badge>
                  <Badge
                    variant={employee.canLogProduction ? "default" : "outline"}
                  >
                    {employee.canLogProduction
                      ? "Production access"
                      : "No production access"}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
