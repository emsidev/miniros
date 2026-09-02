export type NumericExpressionResult =
  { ok: true; value: number } | { ok: false; error: string };

const operatorAliases: Record<string, string> = {
  "−": "-",
  "×": "*",
  "÷": "/",
};

class NumericExpressionParser {
  private readonly input: string;
  private index = 0;

  constructor(input: string) {
    this.input = input.replace(
      /[−×÷]/g,
      (character) => operatorAliases[character],
    );
  }

  parse(): NumericExpressionResult {
    this.skipWhitespace();
    if (this.index === this.input.length) {
      return { ok: false, error: "Enter a number or calculation." };
    }

    try {
      const value = this.parseExpression();
      this.skipWhitespace();
      if (this.index !== this.input.length) {
        throw new Error("Use only numbers and +, −, ×, ÷, and parentheses.");
      }
      if (!Number.isFinite(value)) {
        throw new Error("Calculation must produce a finite number.");
      }
      if (Math.abs(value) >= 1e21) {
        throw new Error("Calculation is too large.");
      }
      return { ok: true, value };
    } catch (error) {
      return {
        ok: false,
        error:
          error instanceof Error ? error.message : "Enter a valid calculation.",
      };
    }
  }

  private parseExpression(): number {
    let value = this.parseTerm();
    while (true) {
      this.skipWhitespace();
      if (this.consume("+")) {
        value += this.parseTerm();
      } else if (this.consume("-")) {
        value -= this.parseTerm();
      } else {
        return value;
      }
    }
  }

  private parseTerm(): number {
    let value = this.parseUnary();
    while (true) {
      this.skipWhitespace();
      if (this.consume("*")) {
        value *= this.parseUnary();
      } else if (this.consume("/")) {
        const divisor = this.parseUnary();
        if (divisor === 0) throw new Error("Cannot divide by zero.");
        value /= divisor;
      } else {
        return value;
      }
    }
  }

  private parseUnary(): number {
    this.skipWhitespace();
    if (this.consume("+")) return this.parseUnary();
    if (this.consume("-")) return -this.parseUnary();
    return this.parsePrimary();
  }

  private parsePrimary(): number {
    this.skipWhitespace();
    if (this.consume("(")) {
      const value = this.parseExpression();
      this.skipWhitespace();
      if (!this.consume(")"))
        throw new Error("Close each opening parenthesis.");
      return value;
    }

    const start = this.index;
    let digits = 0;
    while (this.isDigit(this.input[this.index])) {
      this.index += 1;
      digits += 1;
    }
    if (this.input[this.index] === ".") {
      this.index += 1;
      while (this.isDigit(this.input[this.index])) {
        this.index += 1;
        digits += 1;
      }
    }
    if (digits === 0) throw new Error("Expected a number.");

    const value = Number(this.input.slice(start, this.index));
    if (!Number.isFinite(value)) throw new Error("Enter a finite number.");
    return value;
  }

  private consume(character: string) {
    if (this.input[this.index] !== character) return false;
    this.index += 1;
    return true;
  }

  private skipWhitespace() {
    while (/\s/.test(this.input[this.index] ?? "")) this.index += 1;
  }

  private isDigit(character: string | undefined) {
    return character !== undefined && character >= "0" && character <= "9";
  }
}

export function evaluateNumericExpression(
  value: FormDataEntryValue | string | number | null | undefined,
): NumericExpressionResult {
  return new NumericExpressionParser(String(value ?? "")).parse();
}

export function numericExpressionToNumber(
  value: FormDataEntryValue | string | number | null | undefined,
) {
  const result = evaluateNumericExpression(value);
  return result.ok ? result.value : Number.NaN;
}

export function formatNumericExpression(value: number, precision: number) {
  if (!Number.isInteger(precision) || precision < 0 || precision > 10) {
    throw new RangeError("precision must be an integer between 0 and 10.");
  }
  if (!Number.isFinite(value)) throw new RangeError("value must be finite.");

  const formatted = value.toFixed(precision);
  return Number(formatted) === 0 ? (0).toFixed(precision) : formatted;
}

export function normalizeNumericExpression(
  value: FormDataEntryValue | string | number | null | undefined,
  precision: number,
) {
  const result = evaluateNumericExpression(value);
  return result.ok
    ? formatNumericExpression(result.value, precision)
    : String(value ?? "").trim();
}

export function isZeroNumericExpression(value: string) {
  const result = evaluateNumericExpression(value);
  return result.ok && result.value === 0;
}

export function containsArithmeticExpression(value: string) {
  const normalized = value.replace(
    /[−×÷]/g,
    (character) => operatorAliases[character],
  );
  const trimmed = normalized.trim();
  return /[+*/()]/.test(trimmed) || /.+-.+/.test(trimmed);
}
