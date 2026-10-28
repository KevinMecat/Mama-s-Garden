export type ProjectActivity = {
  id: string;
  duration: number;
  dependencies: string[];
};

export type CriticalPathActivity = {
  id: string;
  earliestStart: number;
  earliestFinish: number;
  latestStart: number;
  latestFinish: number;
  slack: number;
  critical: boolean;
};

/** CPM measures elapsed duration units, with no assumptions about available resources. */
export function calculateCriticalPath(activities: readonly ProjectActivity[]) {
  const byId = new Map<string, ProjectActivity>();
  for (const activity of activities) {
    if (!activity.id || byId.has(activity.id)) throw Error("Las actividades deben tener identificadores únicos.");
    if (!Number.isFinite(activity.duration) || activity.duration <= 0) throw Error("Cada actividad necesita una duración positiva.");
    if (new Set(activity.dependencies).size !== activity.dependencies.length) throw Error("Hay dependencias duplicadas.");
    byId.set(activity.id, activity);
  }
  const successors = new Map<string, string[]>();
  const indegree = new Map<string, number>();
  for (const activity of activities) {
    indegree.set(activity.id, activity.dependencies.length);
    for (const dependency of activity.dependencies) {
      if (!byId.has(dependency)) throw Error("La dependencia no pertenece al proyecto.");
      successors.set(dependency, [...(successors.get(dependency) ?? []), activity.id]);
    }
  }
  const queue = activities.filter((activity) => indegree.get(activity.id) === 0).map((activity) => activity.id);
  const order: string[] = [];
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const id = queue[cursor];
    order.push(id);
    for (const successor of successors.get(id) ?? []) {
      const count = indegree.get(successor)! - 1;
      indegree.set(successor, count);
      if (count === 0) queue.push(successor);
    }
  }
  if (order.length !== activities.length) throw Error("Las dependencias contienen un ciclo.");
  const earliest = new Map<string, { start: number; finish: number }>();
  for (const id of order) {
    const activity = byId.get(id)!;
    const start = Math.max(0, ...activity.dependencies.map((dependency) => earliest.get(dependency)!.finish));
    earliest.set(id, { start, finish: start + activity.duration });
  }
  const projectDuration = Math.max(0, ...[...earliest.values()].map((row) => row.finish));
  const latest = new Map<string, { start: number; finish: number }>();
  for (const id of [...order].reverse()) {
    const following = successors.get(id) ?? [];
    const finish = following.length ? Math.min(...following.map((successor) => latest.get(successor)!.start)) : projectDuration;
    latest.set(id, { start: finish - byId.get(id)!.duration, finish });
  }
  const results: CriticalPathActivity[] = order.map((id) => {
    const early = earliest.get(id)!, late = latest.get(id)!;
    const slack = late.start - early.start;
    return { id, earliestStart: early.start, earliestFinish: early.finish, latestStart: late.start, latestFinish: late.finish, slack, critical: Math.abs(slack) < 1e-9 };
  });
  return { projectDuration, activities: results, resourceConstraintsConsidered: false as const };
}
