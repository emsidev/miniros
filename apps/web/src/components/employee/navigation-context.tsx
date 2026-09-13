"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type NavigationShift = { id: string; status: string };
const ShiftNavigationContext = createContext<{
  shift: NavigationShift | null;
  setShift: (shift: NavigationShift) => void;
} | null>(null);
export function EmployeeNavigationProvider({
  children,
  identityKey,
}: {
  children: ReactNode;
  identityKey?: string;
}) {
  const [selection, setSelection] = useState<{
    key?: string;
    shift: NavigationShift | null;
  }>({ shift: null });
  useEffect(() => {
    if (!identityKey) return;
    try {
      const raw = localStorage.getItem("miniros:selected-shift:" + identityKey);
      const shift = raw ? (JSON.parse(raw) as NavigationShift) : null;
      if (
        !shift ||
        (typeof shift.id === "string" && typeof shift.status === "string")
      )
        setSelection({ key: identityKey, shift });
    } catch {
      /* A server/local validated scope still works without preference storage. */
    }
  }, [identityKey]);
  const setShift = useCallback(
    (shift: NavigationShift) => {
      setSelection({ key: identityKey, shift });
      if (identityKey)
        try {
          localStorage.setItem(
            "miniros:selected-shift:" + identityKey,
            JSON.stringify(shift),
          );
        } catch {
          /* Journals use IndexedDB, not this preference. */
        }
    },
    [identityKey],
  );
  const value = useMemo(
    () => ({
      shift: selection.key === identityKey ? selection.shift : null,
      setShift,
    }),
    [identityKey, selection, setShift],
  );
  return (
    <ShiftNavigationContext.Provider value={value}>
      {children}
    </ShiftNavigationContext.Provider>
  );
}
/** Only assigned server data or identity-scoped prepared data registers a shift. Never clear it on page unmount. */
export function ShiftNavigationScope({ id, status }: NavigationShift) {
  const setShift = useContext(ShiftNavigationContext)?.setShift;
  useEffect(() => {
    setShift?.({ id, status });
  }, [id, status, setShift]);
  return null;
}
export function useNavigationShift() {
  return useContext(ShiftNavigationContext)?.shift ?? null;
}
