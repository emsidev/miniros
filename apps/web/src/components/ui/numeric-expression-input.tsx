"use client";

import * as React from "react";
import {
  containsArithmeticExpression,
  evaluateNumericExpression,
  formatNumericExpression,
  isZeroNumericExpression,
} from "@/lib/numeric-expression";
import { cn } from "@/lib/utils";
import { Input } from "./input";

type InputProps = React.ComponentProps<typeof Input>;

type NumericExpressionInputProps = Omit<
  InputProps,
  | "type"
  | "inputMode"
  | "value"
  | "defaultValue"
  | "onBlur"
  | "onFocus"
  | "onKeyDown"
  | "min"
  | "max"
> & {
  precision: number;
  value?: InputProps["value"];
  defaultValue?: InputProps["defaultValue"];
  min?: number | string;
  max?: number | string;
  onValueChange?: (value: string) => void;
  onBlur?: React.FocusEventHandler<HTMLInputElement>;
  onFocus?: React.FocusEventHandler<HTMLInputElement>;
  onKeyDown?: React.KeyboardEventHandler<HTMLInputElement>;
  containerClassName?: string;
};

function finiteBound(value: number | string | undefined) {
  if (value === undefined || value === "") return undefined;
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : undefined;
}

export function NumericExpressionInput({
  precision,
  value,
  defaultValue,
  min,
  max,
  onValueChange,
  onChange,
  onBlur,
  onFocus,
  onKeyDown,
  containerClassName,
  id,
  name,
  disabled,
  "aria-describedby": ariaDescribedBy,
  "aria-invalid": ariaInvalid,
  ...props
}: NumericExpressionInputProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [expressionError, setExpressionError] = React.useState<string>();
  const isControlled = value !== undefined;
  const inputValue =
    value === undefined
      ? undefined
      : Array.isArray(value)
        ? value.join(",")
        : String(value);
  const errorId = `${id ?? name ?? "numeric-expression"}-expression-error`;
  const minValue = finiteBound(min);
  const maxValue = finiteBound(max);

  React.useEffect(() => {
    const form = inputRef.current?.form;
    if (!form) return;
    const clearError = () => {
      inputRef.current?.setCustomValidity("");
      setExpressionError(undefined);
    };
    form.addEventListener("reset", clearError);
    return () => form.removeEventListener("reset", clearError);
  }, []);

  function commitExpression(input: HTMLInputElement) {
    const rawValue = input.value.trim();
    if (!rawValue) {
      input.setCustomValidity("");
      setExpressionError(undefined);
      return true;
    }

    const result = evaluateNumericExpression(rawValue);
    if (!result.ok) {
      input.setCustomValidity(result.error);
      setExpressionError(result.error);
      return false;
    }
    if (minValue !== undefined && result.value < minValue) {
      const error = `Enter a value of at least ${minValue}.`;
      input.setCustomValidity(error);
      setExpressionError(error);
      return false;
    }
    if (maxValue !== undefined && result.value > maxValue) {
      const error = `Enter a value no greater than ${maxValue}.`;
      input.setCustomValidity(error);
      setExpressionError(error);
      return false;
    }

    const formatted = formatNumericExpression(result.value, precision);
    input.setCustomValidity("");
    setExpressionError(undefined);
    if (isControlled) {
      onValueChange?.(formatted);
    } else {
      input.value = formatted;
    }
    return true;
  }

  const describedBy =
    [ariaDescribedBy, expressionError ? errorId : undefined]
      .filter(Boolean)
      .join(" ") || undefined;
  const isInvalid =
    expressionError !== undefined ||
    ariaInvalid === true ||
    ariaInvalid === "true";

  return (
    <div className={cn("min-w-0 space-y-1", containerClassName)}>
      <Input
        {...props}
        ref={inputRef}
        id={id}
        name={name}
        type="text"
        inputMode="decimal"
        pattern="[0-9+*/().\\s×÷−-]*"
        value={inputValue}
        defaultValue={defaultValue}
        disabled={disabled}
        aria-invalid={isInvalid}
        aria-describedby={describedBy}
        onChange={(event) => {
          event.currentTarget.setCustomValidity("");
          setExpressionError(undefined);
          onChange?.(event);
          onValueChange?.(event.target.value);
        }}
        onFocus={(event) => {
          const input = event.currentTarget;
          onFocus?.(event);
          if (!isZeroNumericExpression(input.value)) return;
          requestAnimationFrame(() => {
            if (input.isConnected) input.select();
          });
        }}
        onBlur={(event) => {
          commitExpression(event.currentTarget);
          onBlur?.(event);
        }}
        onKeyDown={(event) => {
          onKeyDown?.(event);
          if (
            event.defaultPrevented ||
            event.key !== "Enter" ||
            !containsArithmeticExpression(event.currentTarget.value)
          ) {
            return;
          }
          event.preventDefault();
          commitExpression(event.currentTarget);
        }}
      />
      {expressionError ? (
        <p
          id={errorId}
          role="alert"
          className="text-xs font-medium text-destructive"
        >
          {expressionError}
        </p>
      ) : null}
    </div>
  );
}
