import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  access: vi.fn(),
  payment: vi.fn(),
  discount: vi.fn(),
}));
vi.mock("@/server/services/access", () => ({
  requireActiveBusiness: mocks.access,
}));
vi.mock("@/server/services/payment-proofs", () => ({
  attachPaymentProof: mocks.payment,
}));
vi.mock("@/server/services/discount-proofs", () => ({
  attachDiscountProof: mocks.discount,
}));
import { AccessError } from "@/server/services/access-error";
import { POST } from "./route";
beforeEach(() => vi.resetAllMocks());
it("rejects unauthorized proof uploads without consuming any body", async () => {
  mocks.access.mockRejectedValue(new AccessError("Please sign in."));
  const getReader = vi.fn(() => {
    throw new Error("Body must remain unread");
  });
  const request = {
    url: "https://miniros.test/api/offline/proof",
    headers: new Headers({ Origin: "https://miniros.test" }),
    body: { getReader },
  } as unknown as Request;
  expect((await POST(request)).status).toBe(403);
  expect(getReader).not.toHaveBeenCalled();
  expect(mocks.payment).not.toHaveBeenCalled();
  expect(mocks.discount).not.toHaveBeenCalled();
});
it.each(["paymentId", "saleId"])(
  "keeps authorized %s proof dispatch",
  async (field) => {
    mocks.access.mockResolvedValue({});
    mocks.payment.mockResolvedValue({ saved: "payment" });
    mocks.discount.mockResolvedValue({ saved: "discount" });
    const form = new FormData();
    form.set(field, "record-id");
    form.set("fileId", "file-id");
    form.set("file", new File(["photo"], "photo.jpg", { type: "image/jpeg" }));
    const response = await POST(
      new Request("https://miniros.test/api/offline/proof", {
        method: "POST",
        headers: { Origin: "https://miniros.test" },
        body: form,
      }),
    );
    expect(response.status).toBe(200);
    expect(mocks.access).toHaveBeenCalledWith({ employeePermission: "pos" });
    expect(
      field === "saleId" ? mocks.discount : mocks.payment,
    ).toHaveBeenCalledOnce();
  },
);
