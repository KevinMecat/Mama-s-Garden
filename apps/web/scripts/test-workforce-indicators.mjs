import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
const compiled = ts.transpileModule(fs.readFileSync("src/lib/workforce-indicators.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const moduleExports = {};
new Function("exports", compiled)(moduleExports);
const stamp = (n) => ({ toMillis: () => n });
const tasks = [
  { id: "one", activity: "Poda", unit: "árboles", assignees: ["w1"], latestReviewId: "r1", isBlocked: false },
  { id: "crew", activity: "Poda", unit: "árboles", assignees: ["w1", "w2"], latestReviewId: "r2", isBlocked: true },
  { id: "other", activity: "Poda", unit: "metros", assignees: ["w1"], latestReviewId: "r3", isBlocked: false },
];
const logs = [{ taskId: "one", minutes: { w1: 60 } }, { taskId: "crew", minutes: { w1: 120, w2: 60 } }];
const reviews = [{ id: "r1", taskId: "one", accepted: true, acceptedQuantity: 6 }, { id: "r2", taskId: "crew", accepted: true, acceptedQuantity: 10 }, { id: "r3", taskId: "other", accepted: true, acceptedQuantity: 3 }];
const events = [{ taskId: "one", revision: 1, action: "block", createdAt: stamp(0) }, { taskId: "one", revision: 2, action: "unblock", createdAt: stamp(3600000) }, { taskId: "one", revision: 3, action: "return" }];
const rows = moduleExports.workerActivityIndicators("w1", tasks, logs, reviews, events);
const trees = rows.find((row) => row.unit === "árboles");
assert.equal(rows.length, 2);
assert.equal(trees.individualAccepted, 6);
assert.equal(trees.crewAccepted, 10);
assert.equal(trees.hours, 3);
assert.equal(trees.individualRate, 6);
assert.equal(trees.blockedMinutes, 60);
assert.equal(trees.returns, 1);
assert.equal(trees.unresolvedBlock, true);
assert.equal(rows.find((row) => row.unit === "metros").individualRate, null);
console.log("PASS indicators: distinct units, crew attribution, time, return and blocked duration.");
