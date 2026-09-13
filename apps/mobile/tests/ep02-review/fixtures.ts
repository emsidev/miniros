import { createHash } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { Hash, PeerScope } from "../../src/ep02/protocol";
import type { SqlDatabase, SqlExecutor, SqlValue } from "../../src/ep02/store";

export const hash: Hash = async (value) =>
  createHash("sha256").update(value).digest("hex");
export const cashier: PeerScope = {
  businessId: "review-business-a",
  shiftId: "review-shift-a",
  snapshotId: "review-snapshot-a",
  snapshotHash: "a".repeat(64),
  authorityEpoch: 1,
  pairingId: "review-pairing-a",
  localDeviceId: "review-cashier",
  peerDeviceId: "review-prep",
  role: "cashier",
};
export const prep: PeerScope = {
  ...cashier,
  localDeviceId: cashier.peerDeviceId,
  peerDeviceId: cashier.localDeviceId,
  role: "prep",
};

/** Real file-backed SQLite; injected faults are named independently from engine errors. */
export class ReviewSqlite implements SqlDatabase {
  readonly directory = mkdtempSync(join(tmpdir(), "miniros-ep02-independent-"));
  readonly path = join(this.directory, "review.sqlite");
  db = new DatabaseSync(this.path);
  failBeforeCommit = false;
  private tail: Promise<unknown> = Promise.resolve();
  async run(sql: string, params: SqlValue[] = []): Promise<void> {
    this.db.prepare(sql).run(...params);
  }
  async all<T>(sql: string, params: SqlValue[] = []): Promise<T[]> {
    return this.db.prepare(sql).all(...params) as T[];
  }
  exclusive<T>(work: (tx: SqlExecutor) => Promise<T>): Promise<T> {
    const pending = this.tail.then(async () => {
      this.db.exec("BEGIN IMMEDIATE");
      try {
        const result = await work(this);
        if (this.failBeforeCommit) throw new Error("injected-before-commit");
        this.db.exec("COMMIT");
        return result;
      } catch (error) {
        this.db.exec("ROLLBACK");
        throw error;
      }
    });
    this.tail = pending.catch(() => undefined);
    return pending;
  }
  reopen(): void {
    this.db.close();
    this.db = new DatabaseSync(this.path);
  }
  dispose(): void {
    this.db.close();
    rmSync(this.directory, { recursive: true, force: true });
  }
}
