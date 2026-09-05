import { offlineIdentity } from "@/server/services/offline-prepare";
import { offlineResponse } from "@/server/services/offline-http";
export const dynamic = "force-dynamic";
export async function GET() {
  return offlineResponse(offlineIdentity);
}
