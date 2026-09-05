"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

export type SearchOption = {
  value: string;
  label: string;
  detail?: string;
  group?: string;
  disabled?: boolean;
};

export function SearchSelect({
  id,
  label,
  value,
  options,
  onChange,
  disabled,
  error,
  placeholder = "Select…",
}: {
  id: string;
  label: string;
  value: string;
  options: readonly SearchOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  error?: string;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value);
  const groups = [...new Set(options.map((option) => option.group ?? ""))];
  return (
    <div className="min-w-0 space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            role="combobox"
            aria-label={label}
            aria-expanded={open}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? `${id}-error` : undefined}
            disabled={disabled}
            className="h-auto min-h-11 w-full justify-between gap-2 px-3 py-2 text-left font-normal"
          >
            <span className="min-w-0 truncate">
              {selected?.label ?? placeholder}
            </span>
            <ChevronsUpDown
              className="size-4 shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="z-[calc(var(--mi-z-modal)+1)] w-[var(--radix-popover-trigger-width)] max-w-[calc(100vw-2rem)] p-0"
        >
          <Command>
            <CommandInput
              aria-label={`Search ${label.toLowerCase()}`}
              placeholder="Search…"
            />
            <CommandList className="max-h-[min(18rem,var(--radix-popover-content-available-height))]">
              <CommandEmpty>No matches found.</CommandEmpty>
              {groups.map((group) => (
                <CommandGroup heading={group || undefined} key={group}>
                  {options
                    .filter((option) => (option.group ?? "") === group)
                    .map((option) => (
                      <CommandItem
                        key={option.value}
                        value={option.value}
                        keywords={[option.label, option.detail ?? ""]}
                        disabled={option.disabled}
                        className="min-h-11 items-start gap-2 py-3"
                        onSelect={() => {
                          onChange(option.value);
                          setOpen(false);
                        }}
                      >
                        <Check
                          aria-hidden="true"
                          className={cn(
                            "mt-0.5 size-4 shrink-0",
                            option.value !== value && "invisible",
                          )}
                        />
                        <span className="min-w-0 break-words">
                          <span className="block font-medium">
                            {option.label}
                          </span>
                          {option.detail ? (
                            <span className="mt-1 block text-xs text-muted-foreground">
                              {option.detail}
                            </span>
                          ) : null}
                        </span>
                      </CommandItem>
                    ))}
                </CommandGroup>
              ))}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {error ? (
        <p id={`${id}-error`} className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function InventoryToolbar({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const update = () =>
      document.documentElement.style.setProperty(
        "--inventory-toolbar-height",
        `${element.getBoundingClientRect().height}px`,
      );
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => {
      observer.disconnect();
      document.documentElement.style.removeProperty(
        "--inventory-toolbar-height",
      );
    };
  }, []);
  return (
    <div
      ref={ref}
      className="inventory-toolbar sticky top-[var(--workspace-header-height,4rem)] z-20 -mx-4 border-y bg-background px-4 py-3 sm:mx-0 sm:px-0"
    >
      {children}
    </div>
  );
}

export function InventoryDrawer({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  const opener = useRef<HTMLElement | null>(null);
  const [viewport, setViewport] = useState<{ height: number; top: number }>();
  useLayoutEffect(() => {
    if (!open || !window.visualViewport) return;
    const view = window.visualViewport;
    const update = () =>
      setViewport({ height: view.height, top: view.offsetTop });
    update();
    view.addEventListener("resize", update);
    view.addEventListener("scroll", update);
    return () => {
      view.removeEventListener("resize", update);
      view.removeEventListener("scroll", update);
    };
  }, [open]);
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        className="inventory-drawer gap-0 sm:max-w-2xl"
        onOpenAutoFocus={() => {
          opener.current =
            document.activeElement instanceof HTMLElement
              ? document.activeElement
              : null;
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          const target = opener.current;
          requestAnimationFrame(() => {
            if (target?.isConnected) target.focus({ preventScroll: true });
          });
        }}
        style={{
          width: "min(100vw, 42rem)",
          maxWidth: "42rem",
          height: viewport?.height ?? "100dvh",
          top: viewport?.top ?? 0,
          bottom: "auto",
        }}
      >
        <SheetHeader className="shrink-0 border-b p-5 pr-14">
          <SheetTitle className="text-xl font-bold">{title}</SheetTitle>
          <SheetDescription className="mt-2 break-words">
            {description}
          </SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-5">
          {children}
        </div>
        <div className="safe-bottom shrink-0 border-t bg-card px-5 pt-4">
          <div className="flex flex-wrap items-center justify-end gap-2">
            {footer}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function InventoryField({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="min-w-0 space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
