import { Devices } from "@/features/offline/admin-devices";
import {
  getOfflineAdministration,
  offlineRecoveryJournal,
} from "@/server/services/offline-admin";

export const dynamic = "force-dynamic";
export const metadata = { title: "Devices" };

export default async function DevicesPage({
  searchParams,
}: {
  searchParams: Promise<{ session?: string }>;
}) {
  const [sessions, params] = await Promise.all([
    getOfflineAdministration(),
    searchParams,
  ]);
  const selected = sessions.find((session) => session.id === params.session);
  const journal = selected ? await offlineRecoveryJournal(selected.id) : [];
  return (
    <Devices
      sessions={sessions}
      selectedId={params.session}
      journal={journal.map((entry) => ({
        ...entry,
        createdAt: entry.createdAt.toISOString(),
        syncedAt: entry.syncedAt?.toISOString() ?? null,
      }))}
    />
  );
}
