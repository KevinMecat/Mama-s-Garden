import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
const output = ts.transpileModule(fs.readFileSync("src/lib/project-cpm.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const moduleExports = {};
new Function("exports", output)(moduleExports);
const calculate = moduleExports.calculateCriticalPath;
const result = calculate([
  { id: "A", duration: 2, dependencies: [] },
  { id: "B", duration: 3, dependencies: ["A"] },
  { id: "C", duration: 1, dependencies: ["A"] },
  { id: "D", duration: 2, dependencies: ["B", "C"] },
]);
assert.equal(result.projectDuration, 7);
assert.equal(result.activities.find((item) => item.id === "C").slack, 2);
assert.deepEqual(result.activities.filter((item) => item.critical).map((item) => item.id), ["A", "B", "D"]);
assert.equal(result.resourceConstraintsConsidered, false);
assert.throws(() => calculate([{ id: "A", duration: 1, dependencies: ["B"] }, { id: "B", duration: 1, dependencies: ["A"] }]), /ciclo/);
assert.throws(() => calculate([{ id: "A", duration: 1, dependencies: ["missing"] }]), /dependencia/);
assert.throws(() => calculate([{ id: "A", duration: 0, dependencies: [] }]), /duración/);
assert.equal(calculate([]).projectDuration, 0);
console.log("PASS CPM: parallel branches, slack, cycles, missing dependencies and invalid durations.");
