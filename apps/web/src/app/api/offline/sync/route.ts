import { synchronizeOfflineAction } from "@/server/services/offline-sync";
import {
  assertSameOrigin,
  offlineResponse,
  readOfflineJson,
} from "@/server/services/offline-http";
export const runtime = "nodejs";
export async function POST(request: Request) {
  return offlineResponse(async () => {
    assertSameOrigin(request);
    return synchronizeOfflineAction(await readOfflineJson(request));
  });
}
