import { LocalSqliteConnection } from "../../src/storage/v2/connection";
import { LedgerRepository } from "../../src/storage/v2/repository";
import { IndependentSqlite } from "./sqlite-driver";
import { at, fixture, hash, id } from "./fixture";
async function main() {
  const [path, boundary] = process.argv.slice(2);
  if (!path || !boundary || !process.send)
    throw new Error("Missing independent crash fixture arguments");
  const f = await fixture(),
    raw = new IndependentSqlite(path),
    connection = await LocalSqliteConnection.open(raw);
  let armed = false;
  const repo = new LedgerRepository(connection, {
    authority: f.authority,
    hash,
    now: () => at,
    fault: async (point) => {
      if (armed && point === boundary) {
        process.send!({ boundary, pid: process.pid });
        await new Promise<void>(() => {});
      }
    },
  });
  await repo.initialize();
  armed = true;
  await repo.commit(f.sale, {
    draft: { draftId: f.draft.id, revision: 1 },
    attachments: [
      {
        attachmentId: id(14),
        localUri: "file:///review/proof.jpg",
        mediaDigest: "a".repeat(64),
      },
    ],
  });
  throw new Error("Crash boundary not reached");
}
main().catch((error) => {
  process.send?.({ error: String(error) });
  process.exitCode = 1;
});
