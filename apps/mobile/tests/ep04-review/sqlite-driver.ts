import { Worker } from "node:worker_threads";

type SqlValue = string | number | null;
type SqlExecutor = {
  run(sql: string, params?: readonly SqlValue[]): Promise<{ changes: number }>;
  all<T>(sql: string, params?: readonly SqlValue[]): Promise<T[]>;
};

/** Independent real-file SQLite driver, including simultaneous connections. */
export class IndependentSqlite implements SqlExecutor {
  private readonly worker: Worker;
  private nextId = 0;
  private requests = new Map<
    number,
    { resolve: (value: unknown) => void; reject: (error: Error) => void }
  >();
  private transactionTail: Promise<unknown> = Promise.resolve();
  private closed = false;
  beforeCommit: (() => Promise<void>) | null = null;
  constructor(readonly path: string) {
    this.worker = new Worker(new URL("./sqlite-worker.mjs", import.meta.url), {
      workerData: { path },
    });
    this.worker.on(
      "message",
      (message: {
        id: number;
        result?: unknown;
        error?: { message: string; code?: string };
      }) => {
        const waiting = this.requests.get(message.id);
        this.requests.delete(message.id);
        if (message.error)
          waiting?.reject(
            Object.assign(new Error(message.error.message), {
              code: message.error.code,
            }),
          );
        else waiting?.resolve(message.result);
      },
    );
    this.worker.on("error", (error) => {
      for (const request of this.requests.values()) request.reject(error);
      this.requests.clear();
    });
  }
  private request<T>(
    command: string,
    sql = "",
    params: readonly SqlValue[] = [],
  ): Promise<T> {
    if (this.closed)
      return Promise.reject(
        new Error("Independent SQLite connection terminated"),
      );
    const id = ++this.nextId;
    return new Promise<T>((resolve, reject) => {
      this.requests.set(id, {
        resolve: (value) => resolve(value as T),
        reject,
      });
      this.worker.postMessage({ id, command, sql, params });
    });
  }
  run(
    sql: string,
    params: readonly SqlValue[] = [],
  ): Promise<{ changes: number }> {
    return this.request("run", sql, params);
  }
  all<T>(sql: string, params: readonly SqlValue[] = []): Promise<T[]> {
    return this.request<T[]>("all", sql, params);
  }
  exec(sql: string): Promise<void> {
    return this.request("exec", sql);
  }
  exclusive<T>(work: (tx: SqlExecutor) => Promise<T>): Promise<T> {
    const result = this.transactionTail.then(async () => {
      await this.exec("BEGIN IMMEDIATE");
      try {
        const value = await work(this);
        await this.beforeCommit?.();
        await this.exec("COMMIT");
        return value;
      } catch (error) {
        await this.exec("ROLLBACK");
        throw error;
      }
    });
    this.transactionTail = result.catch(() => undefined);
    return result;
  }
  async close(): Promise<void> {
    if (this.closed) return;
    await this.request("close");
    this.closed = true;
    await this.worker.terminate();
  }
  async terminate(): Promise<void> {
    this.closed = true;
    const error = new Error("Independent SQLite connection terminated");
    for (const request of this.requests.values()) request.reject(error);
    this.requests.clear();
    await this.worker.terminate();
  }
}
