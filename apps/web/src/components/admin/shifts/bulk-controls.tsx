"use client";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Send, UsersRound, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { bulkAdminShiftsAction } from "@/server/actions/admin-shifts";
import { bulkDisabledReason, type BulkShiftInput } from "@/lib/shift-planning";
import { formatDate, formatMoney } from "@/lib/format";
import {
  moneyToCents,
  type ActionFeedback,
} from "@/app/admin/_components/form-utils";
import { TeamEditor } from "./team-editor";
import { ShiftFormFeedback } from "./form-feedback";
import type { AdminShift, PlanningEmployee, TeamMember } from "./types";

const operations = [
  { key: "team", label: "Set team", icon: UsersRound },
  { key: "publish", label: "Publish drafts", icon: Send },
  { key: "cancel", label: "Cancel shifts", icon: XCircle },
] as const;
export function BulkShiftControls({
  selected,
  employees,
  onComplete,
  single = false,
  returnTo = "/admin/shifts",
}: {
  selected: AdminShift[];
  employees: PlanningEmployee[];
  onComplete?: () => void;
  single?: boolean;
  returnTo?: string;
}) {
  const router = useRouter();
  const [operation, setOperation] = useState<BulkShiftInput["operation"]>();
  const [review, setReview] = useState<AdminShift[]>([]);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [feedback, setFeedback] = useState<ActionFeedback>({});
  const [pending, startTransition] = useTransition();
  const submitting = useRef(false);
  const trigger = useRef<HTMLButtonElement | null>(null);
  function open(value: BulkShiftInput["operation"], button: HTMLButtonElement) {
    trigger.current = button;
    setReview(selected);
    setOperation(value);
    setTeam([]);
    setFeedback({});
  }
  function apply() {
    if (!operation || submitting.current) return;
    submitting.current = true;
    setFeedback({});
    startTransition(async () => {
      try {
        const result = await bulkAdminShiftsAction({
          operation,
          shifts: review.map((shift) => ({
            id: shift.id,
            updatedAt: shift.updatedAt,
          })),
          assignments:
            operation === "team"
              ? team.map((member) => ({
                  employeeId: member.employeeId,
                  roleOnShift: member.roleOnShift,
                  salaryRateCents: moneyToCents(member.salary),
                }))
              : undefined,
        });
        if (!result.ok) {
          setFeedback(result);
          return;
        }
        toast.success(
          `${result.data.count} ${result.data.count === 1 ? "shift" : "shifts"} ${operation === "team" ? "updated" : operation === "publish" ? "published" : "cancelled"}.`,
        );
        setOperation(undefined);
        onComplete?.();
        router.refresh();
      } catch {
        setFeedback({
          error:
            "The connection was interrupted. Refresh the schedule to check which changes were saved before retrying.",
        });
      } finally {
        submitting.current = false;
      }
    });
  }
  const pay = team.reduce(
    (sum, member) => sum + moneyToCents(member.salary),
    0,
  );
  return (
    <>
      <div className="flex flex-wrap gap-2">
        {operations
          .filter((item) => !single || item.key !== "team")
          .filter(
            (item) =>
              !single ||
              item.key !== "publish" ||
              selected[0]?.status === "draft",
          )
          .map((item) => {
            const reason = bulkDisabledReason(item.key, selected);
            return (
              <div key={item.key} className="space-y-1">
                <Button
                  type="button"
                  variant={
                    single && item.key === "publish" ? "default" : "outline"
                  }
                  disabled={Boolean(reason)}
                  aria-describedby={reason ? `reason-${item.key}` : undefined}
                  onClick={(event) => open(item.key, event.currentTarget)}
                >
                  <item.icon aria-hidden="true" />
                  {single
                    ? item.key === "publish"
                      ? "Publish shift"
                      : "Cancel shift"
                    : item.label}
                </Button>
                {reason && (
                  <p
                    id={`reason-${item.key}`}
                    className="max-w-56 text-xs text-muted-foreground"
                  >
                    {reason}
                  </p>
                )}
              </div>
            );
          })}
      </div>
      <Dialog
        open={Boolean(operation)}
        onOpenChange={(open) => {
          if (!open && !pending) setOperation(undefined);
        }}
      >
        <DialogContent
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            if (trigger.current?.isConnected) trigger.current.focus();
            else
              (
                document.getElementById("shift-workspace-heading") ??
                document.getElementById("shift-detail-heading")
              )?.focus();
          }}
          className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl"
          showCloseButton={!pending}
        >
          <DialogHeader>
            <DialogTitle>
              {operation === "team"
                ? "Replace the selected teams"
                : operation === "publish"
                  ? "Publish these shifts?"
                  : "Cancel these shifts?"}
            </DialogTitle>
            <DialogDescription>
              {operation === "team"
                ? "The team and pay below will replace all current assignments on each selected shift."
                : operation === "publish"
                  ? "The assigned employees will be able to see these shifts in their schedules."
                  : "Employees will no longer be scheduled to work these dates. The shifts and their records stay in History."}
            </DialogDescription>
          </DialogHeader>
          <ShiftFormFeedback feedback={feedback} />
          <div className="max-h-52 overflow-y-auto rounded-lg border">
            <ul className="divide-y">
              {review.map((shift) => (
                <li
                  key={shift.id}
                  id={`field-shifts.${shift.id}`}
                  tabIndex={-1}
                  className="px-4 py-3 text-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <Link
                      href={`/admin/shifts/${shift.id}?returnTo=${encodeURIComponent(returnTo)}`}
                      className="font-semibold underline underline-offset-2"
                    >
                      {shift.title || shift.locationName}
                    </Link>
                    <span>{formatDate(shift.shiftDate)}</span>
                  </div>
                  <p className="mt-1 text-muted-foreground">
                    {shift.locationName} ·{" "}
                    {shift.assignments
                      .filter((item) => item.status !== "cancelled")
                      .map((item) => item.employeeName)
                      .join(", ") || "No staff assigned"}
                  </p>
                  {operation === "team" && (
                    <p className="mt-1 text-muted-foreground">
                      Current staff pay: {formatMoney(shift.salaryCostCents)}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </div>
          {operation === "team" && (
            <>
              <TeamEditor
                employees={employees}
                team={team}
                onChange={setTeam}
                disabled={pending}
                errors={feedback.fieldErrors}
              />
              <p className="text-sm font-semibold">
                New staff pay per shift:{" "}
                {Number.isSafeInteger(pay) && pay >= 0 ? formatMoney(pay) : "—"}
              </p>
              {!team.length && (
                <p className="text-sm text-warning">
                  This removes all assigned staff. Only drafts can be saved
                  without a POS operator.
                </p>
              )}
            </>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => setOperation(undefined)}
            >
              Go back
            </Button>
            <Button
              type="button"
              variant={operation === "cancel" ? "destructive" : "default"}
              disabled={pending}
              onClick={apply}
            >
              {pending
                ? "Saving…"
                : `${operation === "team" ? "Replace team on" : operation === "publish" ? "Publish" : "Cancel"} ${review.length} ${review.length === 1 ? "shift" : "shifts"}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
