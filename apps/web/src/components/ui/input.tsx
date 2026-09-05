import * as React from "react";

import { cn } from "@/lib/utils";

function clearInputValue(input: HTMLInputElement) {
  // Use the native setter so React notices the programmatic change when this
  // input is controlled, then bubble an input event through its normal handler.
  const nativeValueSetter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value",
  )?.set;

  nativeValueSetter?.call(input, "");
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, onFocus, ...props }, ref) => {
    const hasClearedInitialValue = React.useRef(false);

    return (
      <input
        ref={ref}
        type={type}
        data-slot="input"
        className={cn(
          "h-11 w-full min-w-0 rounded-lg border border-input bg-card px-3 py-2 text-base transition-[border-color,box-shadow,background-color] duration-[var(--mi-motion-fast)] ease-[var(--mi-motion-ease-out)] outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-60 aria-invalid:border-destructive aria-invalid:ring-destructive md:text-sm dark:bg-input/30",
          className,
        )}
        {...props}
        onFocus={(event) => {
          onFocus?.(event);

          if (
            type !== "number" ||
            hasClearedInitialValue.current ||
            !event.currentTarget.value
          ) {
            return;
          }

          hasClearedInitialValue.current = true;
          clearInputValue(event.currentTarget);
        }}
      />
    );
  },
);

Input.displayName = "Input";

export { Input };
