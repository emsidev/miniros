/** Actual child process killed by the test at a named SQLite transaction boundary. */
import {
  fixtureSnapshot,
  ids,
  openRepository,
  operations,
  scope,
  uuid,
} from "./fixtures";
async function main() {
  const path = process.argv[2];
  const boundary = process.argv[3];
  if (
    !path ||
    !["before-commit", "after-commit", "failed-autosave"].includes(
      boundary ?? "",
    )
  )
    throw new Error("Expected disposable database path and crash boundary");
  const snapshot = await fixtureSnapshot();
  const input = await operations(snapshot);
  let armed = false;
  const { repository, raw } = await openRepository(path, {
    fault: async (point) => {
      if (armed && point === boundary) {
        process.send?.({ boundary: point });
        await new Promise<void>(() => {});
      }
    },
  });
  if (boundary === "failed-autosave") {
    const retained = await repository.readDraft(scope, uuid(31));
    if (!retained) throw new Error("Missing committed opening draft");
    await raw.exec("PRAGMA query_only=ON");
    let rejected = false;
    try {
      await repository.saveDraft(
        scope,
        {
          ...retained.draft,
          revision: 2,
          data: { counts: [{ itemId: ids.item, kind: "counted", atoms: 999 }] },
        },
        1,
      );
    } catch (error) {
      if (!(error instanceof Error) || !/readonly/i.test(error.message))
        throw error;
      rejected = true;
    }
    if (!rejected)
      throw new Error("Autosave did not encounter a SQLite write failure");
    process.send?.({ boundary });
    await new Promise<void>(() => {});
  }
  armed = true;
  await repository.commit(input.sale, {
    draft: { draftId: ids.draft, revision: 1 },
  });
  throw new Error("The crash fixture unexpectedly ran past its boundary");
}
void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
