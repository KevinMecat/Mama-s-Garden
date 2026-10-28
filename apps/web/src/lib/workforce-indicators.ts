import type { TaskEvent, TaskReview, WorkLog, WorkTask } from "./firebase-workforce-domain";

type TimestampLike = { toMillis(): number };
function millis(value: unknown) {
  return value && typeof (value as TimestampLike).toMillis === "function" ? (value as TimestampLike).toMillis() : null;
}

/** Quantities for a crew remain shared; they are never assigned to individual members. */
export function workerActivityIndicators(workerId: string, tasks: WorkTask[], logs: WorkLog[], reviews: TaskReview[], events: TaskEvent[]) {
  const grouped = new Map<string, { activity: string; unit: string; minutes: number; individualMinutes: number; individualAccepted: number; crewAccepted: number; returns: number; blockedMinutes: number; unresolvedBlock: boolean }>();
  for (const task of tasks.filter((entry) => entry.assignees.includes(workerId))) {
    const key = JSON.stringify([task.activity, task.unit || "cumplimiento"]);
    const row = grouped.get(key) ?? { activity: task.activity, unit: task.unit || "cumplimiento", minutes: 0, individualMinutes: 0, individualAccepted: 0, crewAccepted: 0, returns: 0, blockedMinutes: 0, unresolvedBlock: false };
    const taskLogs = logs.filter((log) => log.taskId === task.id);
    const minutes = taskLogs.reduce((sum, log) => sum + (log.minutes[workerId] ?? 0), 0);
    row.minutes += minutes;
    if (task.assignees.length === 1) row.individualMinutes += minutes;
    const accepted = reviews.find((review) => review.taskId === task.id && review.id === task.latestReviewId && review.accepted);
    if (accepted?.acceptedQuantity !== null && accepted?.acceptedQuantity !== undefined) {
      if (task.assignees.length === 1) row.individualAccepted += accepted.acceptedQuantity;
      else row.crewAccepted += accepted.acceptedQuantity;
    }
    const history = events.filter((event) => event.taskId === task.id).sort((a, b) => a.revision - b.revision);
    row.returns += history.filter((event) => event.action === "return").length;
    let blockedAt: number | null = null;
    for (const event of history) {
      if (event.action === "block") blockedAt = millis(event.createdAt);
      if (event.action === "unblock" && blockedAt !== null) {
        const endedAt = millis(event.createdAt);
        if (endedAt !== null && endedAt >= blockedAt) row.blockedMinutes += (endedAt - blockedAt) / 60000;
        blockedAt = null;
      }
    }
    if (task.isBlocked) row.unresolvedBlock = true;
    grouped.set(key, row);
  }
  return [...grouped.values()].map((row) => ({ ...row, hours: row.minutes / 60, individualRate: row.individualMinutes > 0 ? row.individualAccepted / (row.individualMinutes / 60) : null }));
}
