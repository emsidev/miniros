import { describe, expect, it } from "vitest";
import { emptyShiftProjection } from "@miniros/contracts";
import { preparedFixture } from "@/test/offline-fixture";
import type { LocalSession } from "./store";
import {
  canOpenLocalTask,
  canRecordLocalWork,
  localResumeHref,
  localShiftStatus,
  parseLocalWorkspaceRoute,
  requiresConnection,
} from "./workspace-route";

function session(): LocalSession {
  return {
    ...preparedFixture(),
    projection: emptyShiftProjection(),
    nextSequence: 1,
  };
}

describe("offline employee workspace routes", () => {
  it("uses the same employee URLs instead of exposing the offline shell", () => {
    const saved = session();
    expect(localResumeHref(saved)).toBe(
      `/shifts/${saved.snapshot.shiftId}/start`,
    );
    saved.projection.state = "active";
    expect(localResumeHref(saved)).toBe(`/shifts/${saved.snapshot.shiftId}`);
    saved.projection.state = "closing";
    expect(localResumeHref(saved)).toBe(`/shifts/${saved.snapshot.shiftId}`);
  });

  it("maps local projection state to the normal shift presentation", () => {
    const saved = session();
    expect(localShiftStatus(saved)).toBe("scheduled");
    saved.projection.state = "active";
    expect(localShiftStatus(saved)).toBe("active");
    saved.status = "recovery";
    expect(localShiftStatus(saved)).toBe("closing");
    expect(canRecordLocalWork(saved)).toBe(false);
  });

  it("never reopens a completed closeout for a duplicate submission", () => {
    const saved = session();
    saved.projection.state = "active";
    expect(canOpenLocalTask(saved, "close")).toBe(true);
    saved.projection.state = "closing";
    expect(canOpenLocalTask(saved, "close")).toBe(false);
    expect(canOpenLocalTask(saved, "sell")).toBe(false);
  });

  it("preserves normal route paths and query strings", () => {
    expect(
      parseLocalWorkspaceRoute("/pos?shift=abc", "https://miniros.test"),
    ).toEqual({ path: "/pos", search: "?shift=abc" });
    expect(requiresConnection("/profile")).toBe(true);
    expect(requiresConnection("/shifts/abc/sales")).toBe(false);
  });
});
