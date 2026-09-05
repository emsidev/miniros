import Link from "next/link";
import { z } from "zod";
import { getShiftSaleHistory } from "@/server/services/shift-sale-history";
import { formatMoney, formatPaymentMethod } from "@/lib/format";
export const metadata = { title: "Shift sales and receipts" };
export const dynamic = "force-dynamic";
export default async function SaleHistoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ shiftId: string }>;
  searchParams: Promise<{ cursor?: string }>;
}) {
  const { shiftId } = await params;
  const { cursor } = await searchParams;
  const history = await getShiftSaleHistory(
    z.string().uuid().parse(shiftId),
    cursor ? z.string().uuid().parse(cursor) : undefined,
  );
  return (
    <div className="space-y-5">
      <Link
        className="inline-flex min-h-11 items-center underline"
        href={`/shifts/${shiftId}`}
      >
        Back to shift
      </Link>
      <h1 className="text-2xl font-extrabold">Sales and receipts</h1>
      <p className="text-sm text-muted-foreground">
        These sales are saved on the server.{" "}
        <a className="underline" href="/offline">
          Open this device’s saved and pending sales.
        </a>
      </p>
      {history.sales.length ? (
        history.sales.map((sale) => (
          <details key={sale.id} className="rounded-xl border bg-card p-4">
            <summary className="min-h-11 cursor-pointer font-semibold">
              {formatMoney(sale.totalCents)} ·{" "}
              {sale.soldAt.toLocaleString("en-PH", { timeZone: "Asia/Manila" })}{" "}
              · {sale.status}
            </summary>
            <p className="mt-3 break-all text-xs text-muted-foreground">
              {sale.saleNumber}
            </p>
            <dl className="mt-4 space-y-2">
              {sale.items.map((item) => (
                <div key={item.id} className="flex justify-between gap-3">
                  <dt>
                    {item.productNameSnapshot} × {Number(item.quantity)}
                  </dt>
                  <dd>{formatMoney(item.lineTotalCents)}</dd>
                </div>
              ))}
              <div className="flex justify-between border-t pt-3">
                <dt>Change</dt>
                <dd>{formatMoney(sale.changeCents)}</dd>
              </div>
            </dl>
            {sale.payments.map((payment) => (
              <p key={payment.id} className="mt-2 text-sm">
                {formatPaymentMethod(payment.paymentMethod)}:{" "}
                {formatMoney(payment.amountCents)}{" "}
                {payment.referenceNumber ? `· ${payment.referenceNumber}` : ""}
                {payment.proofFileId ? " · Proof attached" : ""}
              </p>
            ))}
          </details>
        ))
      ) : (
        <p>No server sales recorded for this shift yet.</p>
      )}
      {history.nextCursor ? (
        <Link
          className="inline-flex min-h-11 items-center underline"
          href={`?cursor=${history.nextCursor}`}
        >
          Older sales
        </Link>
      ) : null}
    </div>
  );
}
