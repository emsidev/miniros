import { z } from "zod";
import { offlineResponse } from "@/server/services/offline-http";
import { offlineRecoveryJournal } from "@/server/services/offline-admin";
export async function GET(request: Request) {
  return offlineResponse(() =>
    offlineRecoveryJournal(
      z.string().uuid().parse(new URL(request.url).searchParams.get("session")),
    ),
  );
}
