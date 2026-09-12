import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  expectedDatabaseColumns,
  missingDatabaseColumns,
} from "../../../../packages/db/src/schema-check";

describe("database schema drift check", () => {
  it("fails safely without echoing credentials from a malformed URL", () => {
    const result = spawnSync(
      process.execPath,
      [
        fileURLToPath(
          new URL("../../../../node_modules/tsx/dist/cli.mjs", import.meta.url),
        ),
        fileURLToPath(
          new URL("../../../../scripts/db/check.mts", import.meta.url),
        ),
      ],
      {
        env: {
          ...process.env,
          DATABASE_URL: "postgres://synthetic-user:synthetic-secret@[",
        },
        encoding: "utf8",
        timeout: 10000,
      },
    );
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(1);
    const output = result.stdout + result.stderr;
    expect(output).toContain("Database check failed.");
    expect(output).not.toContain("synthetic-user");
    expect(output).not.toContain("synthetic-secret");
    expect(output).not.toContain("postgres://");
  });

  it("accepts the complete current schema and extra hosted columns", () => {
    expect(
      missingDatabaseColumns([
        ...expectedDatabaseColumns(),
        { table_schema: "auth", table_name: "users", column_name: "email" },
      ]),
    ).toEqual([]);
  });

  it("detects the missing opening-cash and product-stock refactor columns", () => {
    const actual = expectedDatabaseColumns().filter(
      (column) =>
        !(
          column.table_schema === "public" &&
          ((column.table_name === "shifts" &&
            column.column_name === "opening_cash_cents") ||
            (column.table_name === "products" &&
              column.column_name === "stock_inventory_item_id"))
        ),
    );
    expect(missingDatabaseColumns(actual)).toEqual([
      "public.products.stock_inventory_item_id",
      "public.shifts.opening_cash_cents",
    ]);
  });

  it("does not confuse a same-named column in another schema", () => {
    const actual = expectedDatabaseColumns().map((column) =>
      column.table_name === "shifts" &&
      column.column_name === "opening_cash_cents"
        ? { ...column, table_schema: "unrelated" }
        : column,
    );
    expect(missingDatabaseColumns(actual)).toEqual([
      "public.shifts.opening_cash_cents",
    ]);
  });
});
