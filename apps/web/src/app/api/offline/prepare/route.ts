import { z } from "zod";
import { prepareOfflineShift } from "@/server/services/offline-prepare";
import {
  assertSameOrigin,
  offlineResponse,
  readOfflineJson,
} from "@/server/services/offline-http";
export const runtime = "nodejs";
export async function POST(request: Request) {
  return offlineResponse(async () => {
    assertSameOrigin(request);
    const { shiftId } = z
      .object({ shiftId: z.string().uuid() })
      .strict()
      .parse(await readOfflineJson(request));
    return prepareOfflineShift(shiftId);
  });
}
