"use client";

import type { ReactNode } from "react";
import { AlertCircle, Inbox, RotateCcw } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const statusStyles: Record<string, string> = {
  active: "bg-success-surface text-success",
  scheduled: "bg-info-surface text-info",
  closing: "bg-warning-surface text-warning",
  closed: "bg-muted text-muted-foreground",
  cancelled: "bg-destructive-surface text-destructive",
  pending: "bg-warning-surface text-warning",
  approved: "bg-success-surface text-success",
  rejected: "bg-destructive-surface text-destructive",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <Badge
      className={cn(
        "border-0 capitalize shadow-none",
        statusStyles[status] ?? "bg-muted text-muted-foreground",
      )}
    >
      {status.replaceAll("_", " ")}
    </Badge>
  );
}

export function ProfitBadge({
  result,
  amount,
}: {
  result: "profit" | "break_even" | "loss";
  amount?: string;
}) {
  const label =
    result === "break_even"
      ? "Break even"
      : result === "profit"
        ? "Profit"
        : "Loss";
  return (
    <Badge
      className={cn(
        "border-0 shadow-none",
        result === "profit" && "bg-success-surface text-success",
        result === "break_even" && "bg-warning-surface text-warning",
        result === "loss" && "bg-destructive-surface text-destructive",
      )}
    >
      {label}
      {amount ? ` · ${amount}` : ""}
    </Badge>
  );
}

export function LocationProfitBadge({
  recommendation,
}: {
  recommendation:
    "worth_renting_again" | "needs_review" | "not_worth_renting_again";
}) {
  const copy = {
    worth_renting_again: "Worth renting again",
    needs_review: "Needs review",
    not_worth_renting_again: "Not worth renting again",
  }[recommendation];
  return (
    <Badge
      className={cn(
        "border-0 shadow-none",
        recommendation === "worth_renting_again" &&
          "bg-success-surface text-success",
        recommendation === "needs_review" && "bg-warning-surface text-warning",
        recommendation === "not_worth_renting_again" &&
          "bg-destructive-surface text-destructive",
      )}
    >
      {copy}
    </Badge>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <Card className="rounded-xl border-dashed py-12 text-center shadow-none">
      <CardContent className="mx-auto max-w-md space-y-3">
        <span className="mx-auto grid size-11 place-items-center rounded-lg bg-muted">
          <Inbox className="size-5" aria-hidden="true" />
        </span>
        <div>
          <h2 className="font-bold">{title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
        {action}
      </CardContent>
    </Card>
  );
}

export function ErrorState({
  title = "Something went wrong",
  description,
  retry,
}: {
  title?: string;
  description: string;
  retry?: () => void;
}) {
  return (
    <Alert variant="destructive" className="rounded-xl">
      <AlertCircle aria-hidden="true" />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription className="space-y-3">
        <p>{description}</p>
        {retry ? (
          <Button type="button" variant="outline" size="sm" onClick={retry}>
            <RotateCcw aria-hidden="true" />
            Try again
          </Button>
        ) : null}
      </AlertDescription>
    </Alert>
  );
}

export function LoadingSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3" aria-label="Loading">
      <Skeleton className="h-8 w-48" />
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton key={index} className="h-24 w-full rounded-xl" />
      ))}
    </div>
  );
}
