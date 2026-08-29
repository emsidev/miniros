"use client";

import {
  useState,
  useTransition,
  type ComponentProps,
  type ReactNode,
} from "react";
import type { ActionResult } from "@miniros/contracts";
import { AlertCircle } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ActionFeedback } from "./form-utils";
import { firstFieldError } from "./form-utils";

export function ActionErrorAlert({ feedback }: { feedback: ActionFeedback }) {
  return feedback.error ? (
    <Alert variant="destructive" className="rounded-xl">
      <AlertCircle aria-hidden="true" />
      <AlertTitle>Could not save</AlertTitle>
      <AlertDescription>{feedback.error}</AlertDescription>
    </Alert>
  ) : null;
}

export function SetupInput({
  label,
  feedback,
  hint,
  className,
  ...props
}: ComponentProps<typeof Input> & {
  label: string;
  feedback: ActionFeedback;
  hint?: string;
}) {
  const inputId = props.id ?? props.name;
  const error = props.name ? firstFieldError(feedback, props.name) : undefined;
  const helpId = error
    ? `${inputId}-error`
    : hint
      ? `${inputId}-hint`
      : undefined;

  return (
    <div className="space-y-2">
      <Label htmlFor={inputId}>{label}</Label>
      <Input
        {...props}
        id={inputId}
        aria-invalid={Boolean(error)}
        aria-describedby={helpId}
        className={`h-11 rounded-xl ${className ?? ""}`}
      />
      {error ? (
        <p id={helpId} className="text-xs font-medium text-destructive">
          {error}
        </p>
      ) : hint ? (
        <p id={helpId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function ToggleField({
  id,
  label,
  description,
  checked,
  onCheckedChange,
  disabled,
}: {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border p-3">
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={(value) => onCheckedChange(value === true)}
        disabled={disabled}
        className="mt-0.5"
      />
      <div className="space-y-1">
        <Label htmlFor={id}>{label}</Label>
        <p className="text-xs leading-relaxed text-muted-foreground">
          {description}
        </p>
      </div>
    </div>
  );
}

export function FieldGroup({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-bold">{label}</legend>
      {children}
    </fieldset>
  );
}

export function SoftDeleteButton({
  entityName,
  onDelete,
  onDeleted,
  triggerLabel = "Delete",
  title = `Delete ${entityName}?`,
  description = "This removes it from active setup while preserving its historical records. This action can be blocked when active workflows depend on it.",
  confirmLabel = "Delete",
}: {
  entityName: string;
  onDelete: () => Promise<ActionResult<unknown>>;
  onDeleted: () => void;
  triggerLabel?: string;
  title?: string;
  description?: string;
  confirmLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string>();

  function handleDelete() {
    setError(undefined);
    startTransition(async () => {
      const result = await onDelete();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setOpen(false);
      onDeleted();
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button type="button" variant="destructive" disabled={isPending}>
          {triggerLabel}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        {error ? (
          <p className="text-sm font-medium text-destructive">{error}</p>
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Keep it</AlertDialogCancel>
          <AlertDialogAction asChild>
            <Button
              type="button"
              variant="destructive"
              disabled={isPending}
              onClick={(event) => {
                event.preventDefault();
                handleDelete();
              }}
            >
              {isPending ? "Working…" : confirmLabel}
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
