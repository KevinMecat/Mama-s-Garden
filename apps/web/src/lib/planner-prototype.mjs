// Isolated prototype: one binary assignment per person, task and half-hour slot.
// Not connected to live data or production writes.
import solver from "javascript-lp-solver";

export function solvePrototype({ workers, tasks, slots, fixed = [], toolCapacities = {} }) {
  if (!Number.isInteger(slots) || slots < 1 || slots > 24 || workers.length > 12 || tasks.length > 30)
    throw new Error("Dimensiones fuera del límite del prototipo.");
  const constraints = {}, variables = {}, binaries = {};
  if (new Set(workers.map((worker) => worker.id)).size !== workers.length || new Set(tasks.map((task) => task.id)).size !== tasks.length)
    throw new Error("Los identificadores deben ser únicos.");
  if (workers.some((worker) => !Number.isFinite(worker.availableHours) || worker.availableHours < 0) || tasks.some((task) => !Number.isFinite(task.hours) || task.hours <= 0 || !Number.isFinite(task.priority) || task.priority <= 0))
    throw new Error("Capacidades y prioridades inválidas.");
  const add = (name, variable, coefficient) => { variable[name] = (variable[name] ?? 0) + coefficient; };
  for (let i = 0; i < workers.length; i++) {
    constraints[`hours_${i}`] = { max: workers[i].availableHours };
    for (let k = 0; k < slots; k++) constraints[`worker_${i}_${k}`] = { max: 1 };
  }
  for (let j = 0; j < tasks.length; j++) {
    const task = tasks[j];
    constraints[`need_${j}`] = { max: task.hours };
    for (let k = 0; k < slots; k++) {
      constraints[`supervision_${j}_${k}`] = { max: 0 };
      if (task.tool) {
        const capacity = toolCapacities[task.tool] ?? 1;
        if (!Number.isInteger(capacity) || capacity < 0 || capacity > 100) throw new Error("Cantidad de herramientas inválida.");
        constraints[`tool_${task.tool}_${k}`] = { max: capacity };
      }
    }
    for (let i = 0; i < workers.length; i++) {
      const skill = workers[i].skills[task.activity];
      if (!workers[i].present || !["independent", "assisted"].includes(skill)) continue;
      for (let k = 0; k < slots; k++) {
        const id = `x_${i}_${j}_${k}`;
        const v = { objective: task.priority * 0.5, [`hours_${i}`]: 0.5, [`worker_${i}_${k}`]: 1, [`need_${j}`]: 0.5 };
        add(`supervision_${j}_${k}`, v, skill === "assisted" ? 1 : -workers.length);
        variables[id] = v; binaries[id] = 1;
      }
    }
    if (task.tool) for (let k = 0; k < slots; k++) {
      const used = `tooluse_${j}_${k}`, v = { [`tool_${task.tool}_${k}`]: 1 };
      variables[used] = v; binaries[used] = 1;
      for (let i = 0; i < workers.length; i++) {
        const id = `x_${i}_${j}_${k}`;
        if (!variables[id]) continue;
        const link = `link_${i}_${j}_${k}`;
        constraints[link] = { max: 0 };
        add(link, variables[id], 1); add(link, v, -1);
      }
    }
  }
  for (const assignment of fixed) {
    const i = workers.findIndex((worker) => worker.id === assignment.workerId);
    const j = tasks.findIndex((task) => task.id === assignment.taskId);
    if (i < 0 || j < 0 || !Number.isInteger(assignment.slot) || assignment.slot < 0 || assignment.slot >= slots)
      throw new Error("Asignación fija inválida.");
    const id = `x_${i}_${j}_${assignment.slot}`;
    if (!variables[id]) return { feasible: false, assignments: [] };
    const constraint = `fixed_${i}_${j}_${assignment.slot}`;
    constraints[constraint] = { equal: 1 };
    add(constraint, variables[id], 1);
  }
  const result = solver.Solve({ optimize: "objective", opType: "max", constraints, variables, binaries, options: { timeout: 1000 } });
  if (!result.feasible) return { feasible: false, assignments: [] };
  const assignments = [];
  for (let i = 0; i < workers.length; i++) for (let j = 0; j < tasks.length; j++) for (let k = 0; k < slots; k++)
    if ((result[`x_${i}_${j}_${k}`] ?? 0) > 0.5) assignments.push({ workerId: workers[i].id, taskId: tasks[j].id, slot: k, hours: 0.5 });
  // The simplified solver result does not prove optimality on timeout.
  return { feasible: true, assignments };
}
