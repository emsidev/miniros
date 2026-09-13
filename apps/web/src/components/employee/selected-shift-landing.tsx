"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Restore only a server-validated assignment; never infer which of several shifts to use. */
export function SelectedShiftLanding({
  identityKey,
  shifts,
  showAll,
}: {
  identityKey: string;
  shifts: readonly { id: string; status: string; assignmentStatus: string }[];
  showAll: boolean;
}) {
  const router = useRouter();
  useEffect(() => {
    if (showAll) return;
    const eligible = shifts.filter(
      (shift) =>
        ["scheduled", "active", "closing"].includes(shift.status) &&
        ["assigned", "confirmed"].includes(shift.assignmentStatus),
    );
    let selected: string | undefined;
    try {
      selected = JSON.parse(
        localStorage.getItem("miniros:selected-shift:" + identityKey) ?? "null",
      )?.id;
    } catch {}
    const restored = eligible.find((shift) => shift.id === selected);
    const next = restored ?? (eligible.length === 1 ? eligible[0] : undefined);
    if (next) router.replace("/shifts/" + next.id);
  }, [identityKey, shifts, showAll, router]);
  return null;
}
