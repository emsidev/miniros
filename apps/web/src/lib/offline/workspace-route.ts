import type { LocalSession } from "./store";

export type LocalWorkspaceRoute = { path: string; search: string };

export function localShiftStatus(session: LocalSession) {
  if (session.status === "closed") return "closed";
  if (session.status === "recovery") return "closing";
  return session.projection.state === "prepared"
    ? "scheduled"
    : session.projection.state;
}

export function canRecordLocalWork(session: LocalSession) {
  return !["recovery", "closed", "released"].includes(session.status);
}

export function canOpenLocalTask(
  session: LocalSession,
  task: "start" | "sell" | "inventory" | "close",
) {
  if (!canRecordLocalWork(session)) return false;
  if (task === "start") return session.projection.state === "prepared";
  return session.projection.state === "active";
}

/** Returns the normal employee URL that best resumes locally saved work. */
export function localResumeHref(session: LocalSession) {
  const shift = `/shifts/${session.snapshot.shiftId}`;
  return session.projection.state === "prepared" ? `${shift}/start` : shift;
}

export function parseLocalWorkspaceRoute(
  href: string,
  origin = "https://miniros.local",
): LocalWorkspaceRoute {
  const url = new URL(href, origin);
  return { path: url.pathname, search: url.search };
}

export function requiresConnection(path: string) {
  return ["/profile", "/production", "/schedule"].some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );
}
