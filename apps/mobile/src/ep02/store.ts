import {
  assertIncomingScope,
  canonical,
  encode,
  MAX_REORDER_WINDOW,
  MAX_STORED_MESSAGES,
  ProtocolError,
  scopeKey,
  wireScope,
  type DurableReceipt,
  type PeerScope,
  type TestEnvelope,
} from "./protocol";
export type SqlValue = string | number | null;
export interface SqlExecutor {
  run(sql: string, params?: SqlValue[]): Promise<void>;
  all<T>(sql: string, params?: SqlValue[]): Promise<T[]>;
}
/** exclusive must resolve only after COMMIT, and roll back on callback failure. */
export interface SqlDatabase extends SqlExecutor {
  exclusive<T>(work: (tx: SqlExecutor) => Promise<T>): Promise<T>;
}
interface InboxRow {
  wire: string;
  receipt: string;
  sequence: number;
}
interface OutboxRow {
  wire: string;
  receipt: string | null;
  sequence: number;
}
export class PeerStore {
  private readonly key: string;
  constructor(
    private readonly db: SqlDatabase,
    readonly scope: PeerScope,
    private readonly now = () => new Date().toISOString(),
  ) {
    this.key = scopeKey(scope);
  }
  async initialize(): Promise<void> {
    await this.db.run("PRAGMA journal_mode = WAL");
    await this.db.run("PRAGMA synchronous = FULL");
    await this.db.run("PRAGMA busy_timeout = 5000");
    await this.db.run(
      "CREATE TABLE IF NOT EXISTS ep02_inbox (scope TEXT NOT NULL, message_id TEXT NOT NULL, sequence INTEGER NOT NULL, wire TEXT NOT NULL, receipt TEXT NOT NULL, PRIMARY KEY(scope, message_id), UNIQUE(scope, sequence))",
    );
    await this.db.run(
      "CREATE TABLE IF NOT EXISTS ep02_outbox (scope TEXT NOT NULL, message_id TEXT NOT NULL, sequence INTEGER NOT NULL, wire TEXT NOT NULL, receipt TEXT, PRIMARY KEY(scope, message_id), UNIQUE(scope, sequence))",
    );
    await this.db.run(
      "CREATE TABLE IF NOT EXISTS ep02_quarantine (id INTEGER PRIMARY KEY AUTOINCREMENT, scope TEXT NOT NULL, reason TEXT NOT NULL, evidence TEXT NOT NULL)",
    );
  }
  async enqueue(envelope: TestEnvelope): Promise<void> {
    if (
      canonical({ ...wireScope(this.scope) }) !==
      canonical(
        Object.fromEntries(
          Object.keys(wireScope(this.scope)).map((key) => [
            key,
            envelope[key as keyof TestEnvelope],
          ]),
        ),
      )
    )
      throw new ProtocolError("wrong-scope");
    const wire = encode(envelope);
    await this.db.exclusive(async (tx) => {
      const [existing] = await tx.all<OutboxRow>(
        "SELECT wire, receipt, sequence FROM ep02_outbox WHERE scope = ? AND message_id = ?",
        [this.key, envelope.messageId],
      );
      if (existing) {
        if (existing.wire !== wire) throw new ProtocolError("id-conflict");
        return;
      }
      const [count] = await tx.all<{ n: number; highest: number }>(
        "SELECT COUNT(*) AS n, COALESCE(MAX(sequence), 0) AS highest FROM ep02_outbox WHERE scope = ?",
        [this.key],
      );
      if (!count || count.n >= MAX_STORED_MESSAGES)
        throw new ProtocolError("storage-bound");
      if (envelope.sequence !== count.highest + 1)
        throw new ProtocolError("noncontiguous-send");
      await tx.run(
        "INSERT INTO ep02_outbox (scope, message_id, sequence, wire) VALUES (?, ?, ?, ?)",
        [this.key, envelope.messageId, envelope.sequence, wire],
      );
    });
  }
  async accept(
    envelope: TestEnvelope,
  ): Promise<{ receipt: DurableReceipt; isNew: boolean; contiguous: number }> {
    assertIncomingScope(envelope, this.scope);
    const wire = encode(envelope);
    return this.db.exclusive(async (tx) => {
      const [existing] = await tx.all<InboxRow>(
        "SELECT wire, receipt, sequence FROM ep02_inbox WHERE scope = ? AND message_id = ?",
        [this.key, envelope.messageId],
      );
      if (existing) {
        if (existing.wire !== wire) throw new ProtocolError("id-conflict");
        return {
          receipt: JSON.parse(existing.receipt) as DurableReceipt,
          isNew: false,
          contiguous: await this.contiguous(tx),
        };
      }
      const [collision] = await tx.all<InboxRow>(
        "SELECT wire, receipt, sequence FROM ep02_inbox WHERE scope = ? AND sequence = ?",
        [this.key, envelope.sequence],
      );
      if (collision) throw new ProtocolError("sequence-conflict");
      const contiguous = await this.contiguous(tx);
      if (envelope.sequence > contiguous + MAX_REORDER_WINDOW)
        throw new ProtocolError("reorder-bound");
      const [count] = await tx.all<{ n: number }>(
        "SELECT COUNT(*) AS n FROM ep02_inbox WHERE scope = ?",
        [this.key],
      );
      if (!count || count.n >= MAX_STORED_MESSAGES)
        throw new ProtocolError("storage-bound");
      const receipt: DurableReceipt = {
        ...wireScope(this.scope),
        version: 1,
        type: "receipt",
        messageId: envelope.messageId,
        sequence: envelope.sequence,
        digest: envelope.digest,
        storedAt: this.now(),
      };
      await tx.run(
        "INSERT INTO ep02_inbox (scope, message_id, sequence, wire, receipt) VALUES (?, ?, ?, ?, ?)",
        [
          this.key,
          envelope.messageId,
          envelope.sequence,
          wire,
          encode(receipt),
        ],
      );
      return { receipt, isNew: true, contiguous: await this.contiguous(tx) };
    });
  }
  private async contiguous(tx: SqlExecutor): Promise<number> {
    const rows = await tx.all<{ sequence: number }>(
      "SELECT sequence FROM ep02_inbox WHERE scope = ? ORDER BY sequence",
      [this.key],
    );
    let through = 0;
    for (const row of rows) {
      if (row.sequence !== through + 1) break;
      through = row.sequence;
    }
    return through;
  }
  async acknowledge(receipt: DurableReceipt): Promise<void> {
    assertIncomingScope(receipt, this.scope);
    await this.db.exclusive(async (tx) => {
      const [row] = await tx.all<OutboxRow>(
        "SELECT wire, receipt, sequence FROM ep02_outbox WHERE scope = ? AND message_id = ?",
        [this.key, receipt.messageId],
      );
      if (!row) throw new ProtocolError("unknown-receipt");
      const envelope = JSON.parse(row.wire) as TestEnvelope;
      if (
        envelope.digest !== receipt.digest ||
        envelope.sequence !== receipt.sequence
      )
        throw new ProtocolError("receipt-mismatch");
      const wire = encode(receipt);
      if (row.receipt && row.receipt !== wire)
        throw new ProtocolError("receipt-conflict");
      await tx.run(
        "UPDATE ep02_outbox SET receipt = ? WHERE scope = ? AND message_id = ?",
        [wire, this.key, receipt.messageId],
      );
    });
  }
  async pending(limit = 64): Promise<TestEnvelope[]> {
    const rows = await this.db.all<{ wire: string }>(
      "SELECT wire FROM ep02_outbox WHERE scope = ? AND receipt IS NULL ORDER BY sequence LIMIT ?",
      [this.key, Math.min(Math.max(limit, 1), 256)],
    );
    return rows.map((row) => JSON.parse(row.wire) as TestEnvelope);
  }
  async stats(): Promise<{
    saved: number;
    received: number;
    pending: number;
    contiguous: number;
    nextSequence: number;
  }> {
    const [sent] = await this.db.all<{
      saved: number;
      pending: number;
      highest: number;
    }>(
      "SELECT COUNT(*) AS saved, COALESCE(SUM(CASE WHEN receipt IS NULL THEN 1 ELSE 0 END),0) AS pending, COALESCE(MAX(sequence),0) AS highest FROM ep02_outbox WHERE scope = ?",
      [this.key],
    );
    const [received] = await this.db.all<{ n: number }>(
      "SELECT COUNT(*) AS n FROM ep02_inbox WHERE scope = ?",
      [this.key],
    );
    return {
      saved: sent?.saved ?? 0,
      received: received?.n ?? 0,
      pending: sent?.pending ?? 0,
      contiguous: await this.contiguous(this.db),
      nextSequence: (sent?.highest ?? 0) + 1,
    };
  }
  async quarantine(reason: string, raw: string): Promise<void> {
    await this.db.exclusive(async (tx) => {
      // Bounded fixture evidence only; no production sale/payment payload is accepted.
      await tx.run(
        "INSERT INTO ep02_quarantine (scope, reason, evidence) VALUES (?, ?, ?)",
        [this.key, reason.slice(0, 128), raw.slice(0, 16_384)],
      );
      await tx.run(
        "DELETE FROM ep02_quarantine WHERE scope = ? AND id NOT IN (SELECT id FROM ep02_quarantine WHERE scope = ? ORDER BY id DESC LIMIT 64)",
        [this.key, this.key],
      );
    });
  }
}
