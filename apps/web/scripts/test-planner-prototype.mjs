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
const infeasible = solvePrototype({ workers: people, tasks, slots: 2, fixed: [{workerId:"a",taskId:"one",slot:0},{workerId:"a",taskId:"two",slot:0}] });
assert.equal(infeasible.feasible, false, "Conflicting fixed assignments are infeasible");
const absentFixed = solvePrototype({ workers: people, tasks, slots: 2, fixed: [{workerId:"c",taskId:"one",slot:0}] });
assert.equal(absentFixed.feasible, false, "An absent worker cannot be fixed to a task");
assert.throws(() => solvePrototype({ workers: people, tasks, slots: 2, fixed: [{workerId:"missing",taskId:"one",slot:0}] }), /inválida/);
assert.throws(() => solvePrototype({ workers: [{...people[0], availableHours: -1}], tasks, slots: 2 }), /inválidas/);
const noTools = solvePrototype({ workers: people, tasks, slots: 2, toolCapacities: {tijera:0} });
assert.equal(noTools.assignments.length, 0, "Unavailable tools prevent assignment");
console.log("PASS isolated planner prototype: capacity, priority, absence, supervision and shared tool.");
