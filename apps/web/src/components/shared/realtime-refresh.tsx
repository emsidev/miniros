"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const operationalTables = [
  "shifts",
  "shift_assignments",
  "sales",
  "payments",
  "production_logs",
  "inventory_events",
  "inventory_balances",
  "cash_deductions",
  "inventory_adjustments",
  "shift_closeouts",
  "offline_sync_actions",
] as const;

export function RealtimeRefresh({ businessId }: { businessId: string }) {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel(`miniros-business-${businessId}`);

    operationalTables.forEach((table) => {
      channel.on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table,
          filter: `business_id=eq.${businessId}`,
        },
        () => router.refresh(),
      );
    });

    channel.subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [businessId, router]);

  return null;
}
