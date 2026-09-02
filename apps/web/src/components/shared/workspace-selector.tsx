"use client";

import type { ComponentType } from "react";
import type { LucideProps } from "lucide-react";
import { LoaderCircle } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

type SelectorIcon = ComponentType<LucideProps>;

export type WorkspaceSelectorOption = {
  value: string;
  label: string;
  meta?: string;
  icon?: SelectorIcon;
};

export function WorkspaceSelector({
  value,
  onValueChange,
  options,
  action,
  icon: TriggerIcon,
  ariaLabel,
  placeholder,
  variant = "header",
  align,
  disabled = false,
  pending = false,
  className,
  contentClassName,
}: {
  value: string;
  onValueChange: (value: string) => void;
  options: readonly WorkspaceSelectorOption[];
  action?: WorkspaceSelectorOption;
  icon: SelectorIcon;
  ariaLabel: string;
  placeholder: string;
  variant?: "header" | "sidebar";
  align?: "start" | "center" | "end";
  disabled?: boolean;
  pending?: boolean;
  className?: string;
  contentClassName?: string;
}) {
  const selectedOption = options.find((option) => option.value === value);
  const Icon = pending ? LoaderCircle : (selectedOption?.icon ?? TriggerIcon);

  return (
    <Select
      value={value}
      onValueChange={onValueChange}
      disabled={disabled || pending}
    >
      <SelectTrigger
        aria-label={ariaLabel}
        aria-busy={pending || undefined}
        title={selectedOption?.label ?? placeholder}
        className={cn(
          "h-10 min-w-0 rounded-xl px-3 font-semibold shadow-sm transition-colors",
          variant === "sidebar"
            ? "w-full border-sidebar-border bg-sidebar-accent text-sidebar-accent-foreground shadow-none hover:bg-sidebar-accent/80 focus-visible:border-sidebar-ring focus-visible:ring-sidebar-ring/30 [&>svg:last-child]:text-sidebar-foreground/60"
            : "border-border bg-card hover:bg-muted",
          className,
        )}
      >
        <Icon
          className={cn("size-4", pending && "animate-spin")}
          aria-hidden="true"
        />
        <SelectValue placeholder={placeholder}>
          <span className="min-w-0 truncate">
            {selectedOption?.label ?? placeholder}
          </span>
        </SelectValue>
      </SelectTrigger>
      <SelectContent
        position="popper"
        align={align ?? (variant === "sidebar" ? "start" : "end")}
        className={cn("min-w-52", contentClassName)}
      >
        {options.map((option) => {
          const OptionIcon = option.icon;
          return (
            <SelectItem
              key={option.value}
              value={option.value}
              textValue={option.label}
              className="min-h-9 px-2.5 pr-8"
            >
              {OptionIcon ? (
                <OptionIcon
                  className="size-4 text-muted-foreground"
                  aria-hidden="true"
                />
              ) : null}
              <span className="min-w-0 truncate font-medium">
                {option.label}
              </span>
              {option.meta ? (
                <span className="ml-auto text-xs capitalize text-muted-foreground">
                  {option.meta}
                </span>
              ) : null}
            </SelectItem>
          );
        })}
        {action ? (
          <>
            <SelectSeparator />
            <SelectItem
              value={action.value}
              textValue={action.label}
              className="min-h-9 px-2.5 pr-8 font-semibold text-foreground focus:bg-accent focus:text-accent-foreground"
            >
              {action.icon ? (
                <action.icon className="size-4" aria-hidden="true" />
              ) : null}
              {action.label}
            </SelectItem>
          </>
        ) : null}
      </SelectContent>
    </Select>
  );
}
