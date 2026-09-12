import { nativeEndpoint } from "@/server/services/native-v2/http";
import { nativeV2Service } from "@/server/services/native-v2/service";
export const runtime = "nodejs";
export async function POST(request: Request) {
  return nativeEndpoint(request, (identity, body) =>
    nativeV2Service().submitPrep(identity, body),
  );
}
