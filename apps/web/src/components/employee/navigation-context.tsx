"use client";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import { usePathname } from "next/navigation";

type NavigationShift = { id: string; status: string; pathname: string };
const ShiftNavigationContext = createContext<{
  shift: NavigationShift | null;
  setShift: Dispatch<SetStateAction<NavigationShift | null>>;
} | null>(null);
export function EmployeeNavigationProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [shift, setShift] = useState<NavigationShift | null>(null);
  const value = useMemo(() => ({ shift, setShift }), [shift]);
  return (
    <ShiftNavigationContext.Provider value={value}>
      {children}
    </ShiftNavigationContext.Provider>
  );
}
/** Registers the server-resolved shift without fetching it again in the shell. */
export function ShiftNavigationScope({
  id,
  status,
}: {
  id: string;
  status: string;
}) {
  const pathname = usePathname();
  const setShift = useContext(ShiftNavigationContext)?.setShift;
  useEffect(() => {
    setShift?.({ id, status, pathname });
    return () =>
      setShift?.((current) =>
        current?.pathname === pathname ? null : current,
      );
  }, [id, status, pathname, setShift]);
  return null;
}
export function useNavigationShift() {
  const pathname = usePathname();
  const shift = useContext(ShiftNavigationContext)?.shift;
  return shift?.pathname === pathname ? shift : null;
}
