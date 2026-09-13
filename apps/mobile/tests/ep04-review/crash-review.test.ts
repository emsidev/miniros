import { fork } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { LocalSqliteConnection } from "../../src/storage/v2/connection";
import { LedgerRepository } from "../../src/storage/v2/repository";
import { IndependentSqlite } from "./sqlite-driver";
import { at, fixture, hash, id } from "./fixture";

describe("EP04 actual OS process termination against real SQLite WAL", () => {
  it.each(["before-commit", "after-commit"])(
    "EP04-T01 SIGKILL at %s recovers an absent or complete sale with original retry receipt",
    async (boundary) => {
      const directory = mkdtempSync(
          join(tmpdir(), "miniros-ep04-sigkill-review-"),
        ),
        path = join(directory, "ledger.sqlite"),
        f = await fixture();
      async function open() {
        const raw = new IndependentSqlite(path);
        const repo = new LedgerRepository(
          await LocalSqliteConnection.open(raw),
          { authority: f.authority, hash, now: () => at },
        );
        await repo.initialize();
        return { raw, repo };
      }
      let active = await open();
      try {
        await active.repo.storeSnapshot(f.snapshot);
        await active.repo.commit(f.opening);
        await active.repo.saveDraft(f.scope, f.draft, null);
        await active.repo.close();
        const child = fork(
          fileURLToPath(new URL("./crash-child.ts", import.meta.url)),
          [path, boundary],
          {
            execArgv: ["--import", "tsx"],
            stdio: ["ignore", "ignore", "pipe", "ipc"],
          },
        );
        let stderr = "";
        child.stderr?.on("data", (chunk) => {
          stderr += String(chunk);
        });
        const exited = new Promise<{
          code: number | null;
          signal: NodeJS.Signals | null;
        }>((resolve) =>
          child.once("exit", (code, signal) => resolve({ code, signal })),
        );
        const reached = new Promise<{ boundary: string; pid: number }>(
          (resolve, reject) => {
            const timeout = setTimeout(() => {
              child.kill("SIGKILL");
              reject(new Error(`Crash child timed out: ${stderr}`));
            }, 10000);
            child.once(
              "message",
              (message: { boundary: string; pid: number; error?: string }) => {
                clearTimeout(timeout);
                if (message.error) reject(new Error(message.error));
                else resolve(message);
              },
            );
            child.once("exit", (code) => {
              clearTimeout(timeout);
              if (code !== null)
                reject(new Error(`Crash child exited ${code}: ${stderr}`));
            });
          },
        );
        const message = await reached;
        expect(message).toMatchObject({ boundary });
        expect(message.pid).not.toBe(process.pid);
        expect(child.kill("SIGKILL")).toBe(true);
        expect(await exited).toEqual({ code: null, signal: "SIGKILL" });
        active = await open();
        const expected = boundary === "after-commit" ? 2 : 1;
        expect(await active.repo.readiness(f.scope)).toMatchObject({
          operationCount: expected,
          peerPending: expected,
          cloudPending: expected,
          attachmentPending: expected - 1,
        });
        expect(
          (await active.repo.readProjection(f.scope)).stockAtoms[id(5)],
        ).toBe(expected === 2 ? 9 : 10);
        expect(
          (await active.repo.readDraft(f.scope, f.draft.id))
            ?.committedOperationId,
        ).toBe(expected === 2 ? f.sale.operationId : null);
        const retry = await active.repo.commit(f.sale, {
          draft: { draftId: f.draft.id, revision: 1 },
          attachments: [
            {
              attachmentId: id(14),
              localUri: "file:///review/proof.jpg",
              mediaDigest: "a".repeat(64),
            },
          ],
        });
        expect(retry).toMatchObject({
          duplicate: expected === 2,
          receipt: { savedAt: at },
          projection: { grossSalesMinor: 500 },
        });
        expect(
          await active.raw.all("SELECT * FROM v2_local_tenders"),
        ).toHaveLength(1);
      } finally {
        await active.repo.close();
        rmSync(directory, { recursive: true, force: true });
      }
    },
  );
});
