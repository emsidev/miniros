import {
  PersistenceError,
  type FaultHook,
  type RawSqliteConnection,
  type SqlExecutor,
} from "./types";
const sleep = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
function busy(error: unknown): boolean {
  return (
    error instanceof Error &&
    /SQLITE_BUSY|SQLITE_LOCKED|database (?:is )?locked/i.test(error.message)
  );
}
/** One explicitly opened/configured connection; SQLite serializes other real connections. */
export class LocalSqliteConnection {
  private tail: Promise<unknown> = Promise.resolve();
  private closed = false;
  private constructor(private readonly raw: RawSqliteConnection) {}
  static async open(raw: RawSqliteConnection): Promise<LocalSqliteConnection> {
    const connection = new LocalSqliteConnection(raw);
    try {
      await raw.exec("PRAGMA busy_timeout = 25");
      await connection.retry(() => raw.exec("PRAGMA journal_mode = WAL"));
      await raw.exec("PRAGMA synchronous = FULL");
      await raw.exec("PRAGMA foreign_keys = ON");
      const [foreignKeys] = await raw.all<{ foreign_keys: number }>(
        "PRAGMA foreign_keys",
      );
      const [synchronous] = await raw.all<{ synchronous: number }>(
        "PRAGMA synchronous",
      );
      const [journal] = await raw.all<{ journal_mode: string }>(
        "PRAGMA journal_mode",
      );
      if (
        foreignKeys?.foreign_keys !== 1 ||
        synchronous?.synchronous !== 2 ||
        journal?.journal_mode.toLowerCase() !== "wal"
      )
        throw new PersistenceError(
          "UNSAFE_CONNECTION",
          "Foreign keys, FULL synchronization and file-backed WAL are required.",
        );
      return connection;
    } catch (error) {
      await raw.close();
      throw error;
    }
  }
  private async retry<T>(work: () => Promise<T>): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      try {
        return await work();
      } catch (error) {
        if (!busy(error) || attempt >= 79) throw error;
        await sleep(25);
      }
    }
  }
  private serialized<T>(work: () => Promise<T>): Promise<T> {
    const pending = this.tail.then(async () => {
      if (this.closed) throw new PersistenceError("CONNECTION_CLOSED");
      return work();
    });
    this.tail = pending.catch(() => undefined);
    return pending;
  }
  transaction<T>(
    work: (transaction: SqlExecutor) => Promise<T>,
    fault?: FaultHook,
  ): Promise<T> {
    return this.serialized(async () => {
      await this.retry(() => this.raw.exec("BEGIN IMMEDIATE"));
      let committed = false;
      try {
        const result = await work(this.raw);
        await fault?.("before-commit");
        await this.raw.exec("COMMIT");
        committed = true;
        await fault?.("after-commit");
        return result;
      } catch (error) {
        if (!committed) {
          try {
            await this.raw.exec("ROLLBACK");
          } catch {
            /* Preserve the original failure; no reset or false receipt. */
          }
        }
        throw error;
      }
    });
  }
  read<T>(work: (reader: SqlExecutor) => Promise<T>): Promise<T> {
    return this.serialized(async () => {
      await this.raw.exec("BEGIN");
      try {
        const result = await work(this.raw);
        await this.raw.exec("COMMIT");
        return result;
      } catch (error) {
        try {
          await this.raw.exec("ROLLBACK");
        } catch {
          /* Retain evidence. */
        }
        throw error;
      }
    });
  }
  async close(): Promise<void> {
    await this.tail;
    if (!this.closed) {
      this.closed = true;
      await this.raw.close();
    }
  }
}
