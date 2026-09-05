import type { LocalSession } from "./store";

export function requestedShiftId(
  pathname: string,
  params: Pick<URLSearchParams, "get">,
) {
  return (
    pathname.match(/^\/shifts\/([^/]+)(?:\/|$)/)?.[1] ??
    params.get("shift") ??
    undefined
  );
}

export function resolveSavedSession(
  sessions: LocalSession[],
  sessionId?: string,
  shiftId?: string,
) {
  // An explicit target must match; never substitute another saved shift.
  if (sessionId)
    return sessions.find(
      (session) =>
        session.id === sessionId &&
        (!shiftId || session.snapshot.shiftId === shiftId),
    );
  if (shiftId)
    return sessions.find((session) => session.snapshot.shiftId === shiftId);
  return sessions.length === 1 ? sessions[0] : undefined;
}
