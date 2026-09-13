import { is } from "drizzle-orm";
import { getTableConfig, PgTable } from "drizzle-orm/pg-core";
import * as schema from "./schema";

export type DatabaseColumn = {
  table_schema: string;
  table_name: string;
  column_name: string;
};

export function expectedDatabaseColumns(): DatabaseColumn[] {
  return Object.values(schema).flatMap((value) => {
    if (!is(value, PgTable)) return [];
    const table = getTableConfig(value);
    return table.columns.map((column) => ({
      table_schema: table.schema ?? "public",
      table_name: table.name,
      column_name: column.name,
    }));
  });
}

function columnKey(column: DatabaseColumn) {
  return `${column.table_schema}.${column.table_name}.${column.column_name}`;
}

export function missingDatabaseColumns(actual: DatabaseColumn[]) {
  const available = new Set(actual.map(columnKey));
  return expectedDatabaseColumns()
    .filter((column) => !available.has(columnKey(column)))
    .map(columnKey)
    .sort();
}
