import { attachDiscountProof } from "@/server/services/discount-proofs";
import { attachPaymentProof } from "@/server/services/payment-proofs";
import { requireActiveBusiness } from "@/server/services/access";
import {
  assertSameOrigin,
  offlineResponse,
  readOfflineForm,
} from "@/server/services/offline-http";
export const runtime = "nodejs";
export async function POST(request: Request) {
  return offlineResponse(async () => {
    assertSameOrigin(request);
    await requireActiveBusiness({ employeePermission: "pos" });
    const form = await readOfflineForm(request);
    if (form.has("saleId"))
      return attachDiscountProof({
        saleId: String(form.get("saleId")),
        fileId: String(form.get("fileId")),
        file: form.get("file") as File,
      });
    return attachPaymentProof({
      paymentId: String(form.get("paymentId")),
      fileId: String(form.get("fileId")),
      file: form.get("file") as File,
    });
  });
}
