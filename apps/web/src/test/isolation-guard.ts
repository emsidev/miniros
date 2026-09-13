/** Test-only gate: never log a rejected URL (it may contain credentials). */
export function assertDisposableDatabase(url: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("Test database target rejected");
  }
  if (
    !["postgres:", "postgresql:"].includes(parsed.protocol) ||
    parsed.hostname !== "127.0.0.1" ||
    parsed.port !== "55432" ||
    parsed.pathname !== "/miniros_ep00_disposable" ||
    parsed.search ||
    parsed.hash
  ) {
    throw new Error(
      "Test database target rejected: requires dedicated loopback disposable target",
    );
  }
}

export async function withDisposableDatabase<T>(
  url: string,
  write: () => Promise<T>,
): Promise<T> {
  assertDisposableDatabase(url);
  return write();
}
