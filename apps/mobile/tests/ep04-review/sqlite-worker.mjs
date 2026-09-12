import { parentPort, workerData } from "node:worker_threads";
import { DatabaseSync } from "node:sqlite";

// A separate thread keeps SQLite's real lock waits from blocking the test coordinator.
const database = new DatabaseSync(workerData.path);
parentPort.on("message", ({ id, command, sql, params = [] }) => {
  try {
    let result;
    if (command === "run") {
      const outcome = database.prepare(sql).run(...params);
      result = {
        changes: Number(outcome.changes),
        lastInsertRowid: Number(outcome.lastInsertRowid),
      };
    } else if (command === "all") result = database.prepare(sql).all(...params);
    else if (command === "exec") database.exec(sql);
    else if (command === "close") database.close();
    else throw new Error("Unknown independent SQLite worker command");
    parentPort.postMessage({ id, result });
  } catch (error) {
    parentPort.postMessage({
      id,
      error: { message: error.message, code: error.code },
    });
  }
});
