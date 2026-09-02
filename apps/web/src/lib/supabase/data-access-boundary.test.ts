import { readdirSync, readFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const workspaceRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../../../",
);
const sourceRoots = ["apps", "packages"].map((path) =>
  resolve(workspaceRoot, path),
);
const sourceExtensions = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
]);
const ignoredDirectories = new Set([
  ".next",
  "build",
  "coverage",
  "dist",
  "node_modules",
]);
const boundaryImplementations = new Set([
  "apps/web/src/lib/supabase/client.ts",
  "apps/web/src/lib/supabase/middleware.ts",
  "apps/web/src/lib/supabase/server.ts",
  "apps/web/src/lib/supabase/storage-admin.ts",
]);
const thisTest = "apps/web/src/lib/supabase/data-access-boundary.test.ts";

function extension(path: string) {
  const dot = path.lastIndexOf(".");
  return dot === -1 ? "" : path.slice(dot);
}

function collectSourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      return ignoredDirectories.has(entry.name) ? [] : collectSourceFiles(path);
    }
    return entry.isFile() && sourceExtensions.has(extension(entry.name))
      ? [path]
      : [];
  });
}

describe("Supabase data-access boundary", () => {
  it("keeps relational queries in Drizzle", () => {
    const violations: string[] = [];

    for (const path of sourceRoots.flatMap(collectSourceFiles)) {
      const workspacePath = relative(workspaceRoot, path).replaceAll("\\", "/");
      if (workspacePath === thisTest) continue;

      const source = readFileSync(path, "utf8");
      const isBoundaryImplementation =
        boundaryImplementations.has(workspacePath);

      if (
        !isBoundaryImplementation &&
        /import\s*\{[^}]*\bcreate(?:Browser|Server)Client\b[^}]*\}\s*from\s*["']@supabase\/ssr["']/.test(
          source,
        )
      ) {
        violations.push(
          `${workspacePath}: Supabase SSR clients must be created in lib/supabase`,
        );
      }

      if (
        !isBoundaryImplementation &&
        /import\s*\{[^}]*\bcreateClient\b[^}]*\}\s*from\s*["']@supabase\/supabase-js["']/.test(
          source,
        )
      ) {
        violations.push(
          `${workspacePath}: Supabase clients must be created in lib/supabase`,
        );
      }

      if (/from\s*["']@supabase\/postgrest-js["']/.test(source)) {
        violations.push(
          `${workspacePath}: PostgREST bypasses the Drizzle data layer`,
        );
      }

      if (/\/rest\/v1(?:\/|\b)/.test(source)) {
        violations.push(
          `${workspacePath}: direct Supabase Data API requests bypass Drizzle`,
        );
      }

      if (
        /\b(?:supabase|supabaseClient|supabaseAdmin|postgrest|postgrestClient)\s*\.\s*(?:from|rpc|schema)\s*\(/.test(
          source,
        )
      ) {
        violations.push(
          `${workspacePath}: Supabase table queries and RPCs must use Drizzle services`,
        );
      }
    }

    expect(violations).toEqual([]);
  });
});
