import { AdminTable } from "@/components/shared/admin-table";
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState, StatusBadge } from "@/components/shared/feedback";
import { PageHeader } from "@/components/shared/layout";
import { Badge } from "@/components/ui/badge";
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
        <AdminTable label="Employees">
          <TableHeader>
            <TableRow>
              <TableHead scope="col">Employee</TableHead>
              <TableHead scope="col">Contact</TableHead>
              <TableHead scope="col" className="text-right">
                Rate per shift
              </TableHead>
              <TableHead scope="col">Access</TableHead>
              <TableHead scope="col">Status</TableHead>
              <TableHead scope="col" className="text-right">
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {employees.map((employee) => (
              <TableRow key={employee.id}>
                <TableCell className="min-w-44 max-w-72 whitespace-normal break-words font-semibold">
                  {employee.displayName}
                </TableCell>
                <TableCell className="min-w-48 max-w-72 whitespace-normal break-words text-muted-foreground">
                  {employee.email ? <p>{employee.email}</p> : null}
                  {employee.phone ? <p>{employee.phone}</p> : null}
                  {!employee.email && !employee.phone
                    ? "No contact details"
                    : null}
                </TableCell>
                <TableCell className="text-right font-semibold">
                  {formatMoney(employee.defaultShiftRateCents)}
                </TableCell>
                <TableCell>
                  <div className="flex flex-col items-start gap-2">
                    <Badge variant={employee.canUsePos ? "default" : "outline"}>
                      {employee.canUsePos ? "POS access" : "No POS access"}
                    </Badge>
                    <Badge
                      variant={
                        employee.canLogProduction ? "default" : "outline"
                      }
                    >
                      {employee.canLogProduction
                        ? "Production access"
                        : "No production access"}
                    </Badge>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col items-start gap-2">
                    <StatusBadge status={employee.status} />
                    {employee.memberStatus === "pending" ? (
                      <Badge variant="outline">Invitation pending</Badge>
                    ) : null}
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <CreateEmployeeDialog employee={employee} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </AdminTable>
      )}
    </>
  );
}
