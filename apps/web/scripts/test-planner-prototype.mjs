import assert from "node:assert/strict";
import { solvePrototype } from "../src/lib/planner-prototype.mjs";
const people = [
  { id: "a", present: true, availableHours: 1, skills: { poda: "independent" } },
  { id: "b", present: true, availableHours: 1, skills: { poda: "assisted" } },
  { id: "c", present: false, availableHours: 8, skills: { poda: "independent" } },
];
const tasks = [{ id: "one", activity: "poda", hours: 2, priority: 5, tool: "tijera" }, { id: "two", activity: "poda", hours: 2, priority: 1, tool: "tijera" }];
const result = solvePrototype({ workers: people, tasks, slots: 2 });
assert.equal(result.feasible, true);
assert.equal(result.assignments.reduce((n, a) => n + a.hours, 0), 2);
assert.ok(result.assignments.every((a) => a.taskId === "one" && a.workerId !== "c"));
for (const a of result.assignments.filter((x) => x.workerId === "b")) assert.ok(result.assignments.some((x) => x.workerId === "a" && x.taskId === a.taskId && x.slot === a.slot));
assert.deepEqual(solvePrototype({ workers: [], tasks, slots: 2 }).assignments, []);
console.log("PASS isolated planner prototype: capacity, priority, absence, supervision and shared tool.");
