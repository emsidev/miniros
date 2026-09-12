import type { Database } from "@miniros/db";
import type { V2Receipt } from "@miniros/domain/v2";

export type NativeTransaction = Parameters<
  Parameters<Database["transaction"]>[0]
>[0];
export type NativeOptions = {
  now?: () => Date;
  /** Internal fault hook for integration tests. Never supplied by a request. */
  fault?: (
    stage: "after-effects",
    transaction: NativeTransaction,
  ) => Promise<void>;
};
export type NativeFailure = {
  ok: false;
  code: string;
  error: string;
  evidenceId?: string;
  expectedSequence?: number;
};
export type NativeIngestReply =
  { ok: true; receipt: V2Receipt } | NativeFailure;
export type NativePrepReceipt = Readonly<{
  schemaVersion: 2;
  commandId: string;
  businessId: string;
  shiftId: string;
  canonicalDigest: string;
  receivedAt: string;
  outcome: "committed";
}>;
