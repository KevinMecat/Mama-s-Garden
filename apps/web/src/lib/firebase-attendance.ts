import {
  collection,
  doc,
  getDocsFromServer,
  query,
  where,
  runTransaction,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { firebaseClient, type CloudRow } from "@/lib/firebase-client";
import { workerBinding } from "@/lib/firebase-workforce";
import type { AuthUser } from "@/types/auth";
export const attendanceStates = {
  present: "Presente",
  late: "Tarde",
  half: "Medio día",
  absent: "Ausente",
} as const;
export type AttendancePlan = {
  workerId: string;
  date: string;
  status: keyof typeof attendanceStates;
  arrival: string;
  departure: string;
  nextDay: boolean;
  breakMinutes: number;
  justified: boolean;
  note: string;
};
export type AttendanceEntry = AttendancePlan & {
  id: string;
  revision: number;
  updatedBy: string;
  updatedAt?: unknown;
  lastOperationId: string;
  weekStart: string;
};
export function weekFor(date: string) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}
export function workedMinutes(
  row: Pick<
    AttendancePlan,
    "arrival" | "departure" | "nextDay" | "breakMinutes"
  >,
): number | null {
  const valid = (s: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
  if (!valid(row.arrival) || !valid(row.departure)) return null;
  const minutes = (s: string) =>
    Number(s.slice(0, 2)) * 60 + Number(s.slice(3));
  return (
    minutes(row.departure) -
    minutes(row.arrival) +
    (row.nextDay ? 1440 : 0) -
    row.breakMinutes
  );
}
export function validateAttendance(row: AttendancePlan) {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(row.date) ||
    new Date(`${row.date}T00:00:00Z`).toISOString().slice(0, 10) !== row.date
  )
    throw Error("Fecha inválida.");
  if (
    !Object.hasOwn(attendanceStates, row.status) ||
    !row.workerId ||
    row.note.length > 500
  )
    throw Error("Estado o nota inválidos.");
  if (
    ![row.arrival, row.departure].every(
      (t) => t === "" || /^([01]\d|2[0-3]):[0-5]\d$/.test(t),
    )
  )
    throw Error("Usa horas válidas de 00:00 a 23:59.");
  if (
    !Number.isInteger(row.breakMinutes) ||
    row.breakMinutes < 0 ||
    row.breakMinutes > 240
  )
    throw Error("El descanso debe ser de 0 a 240 minutos.");
  if (
    row.status === "absent" &&
    (row.arrival || row.departure || row.nextDay || row.breakMinutes)
  )
    throw Error("Una ausencia no puede registrar horas trabajadas.");
  if (!row.arrival && row.departure)
    throw Error("Registra primero la entrada.");
  const minutes = workedMinutes(row);
  if (minutes !== null && (minutes <= 0 || minutes > 1440))
    throw Error(
      "La salida debe ser posterior a la entrada. Marca turno nocturno si termina al día siguiente.",
    );
  if (minutes === null && (row.nextDay || row.breakMinutes))
    throw Error(
      "Completa entrada y salida antes de descontar descansos o indicar turno nocturno.",
    );
}
export function mergeAttendance(original: CloudRow[], revisions: CloudRow[]) {
  const values = new Map<string, CloudRow>();
  for (const row of [...original].sort((a, b) =>
    String(a.id).localeCompare(String(b.id)),
  ))
    values.set(`${row.workerId}_${row.date}`, row);
  for (const row of revisions)
    values.set(`${row.workerId}_${row.date}`, {
      ...row,
      operationalRevision: true,
    });
  return [...values.values()];
}
export async function readAttendanceRevisions(
  user: AuthUser,
): Promise<CloudRow[]> {
  const { db } = await firebaseClient();
  const source = collection(db, "workforce_attendance");
  const workerId = user.role === "WORKER" ? await workerBinding(user) : null;
  if (user.role === "WORKER" && !workerId) return [];
  const rows = await getDocsFromServer(
    user.role === "WORKER"
      ? query(source, where("workerId", "==", workerId))
      : query(source),
  );
  return rows.docs.map((row) => ({ ...row.data(), id: row.id }));
}
export async function attendanceHistory(
  user: AuthUser,
  workerId: string,
  date: string,
): Promise<CloudRow[]> {
  const { db } = await firebaseClient();
  void user;
  const rows = await getDocsFromServer(
    query(
      collection(db, "workforce_attendance_history"),
      where("workerId", "==", workerId),
      where("date", "==", date),
    ),
  );
  return rows.docs
    .map((row) => ({ ...row.data(), id: row.id }) as CloudRow)
    .sort((a, b) => Number(b.revision) - Number(a.revision));
}
export async function saveAttendance(
  user: AuthUser,
  row: AttendancePlan,
  expectedRevision: number,
  operationId: string,
  reason: string,
) {
  if (!["ADMIN", "MANAGER", "SUPERVISOR"].includes(user.role))
    throw Error(
      "Solo el Administrador o Encargado puede registrar asistencia.",
    );
  validateAttendance(row);
  if (!reason.trim())
    throw Error("Indica el motivo del registro o corrección.");
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Managua",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  if (row.date > today)
    throw Error("No se permite registrar asistencia futura.");
  const { db } = await firebaseClient(),
    id = `${row.workerId}_${row.date}`,
    weekStart = weekFor(row.date);
  const encoded = JSON.stringify({ row, expectedRevision, reason });
  const hash = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(encoded),
  );
  const fingerprint = [...new Uint8Array(hash)]
    .map((n) => n.toString(16).padStart(2, "0"))
    .join("");
  await runTransaction(db, async (tx) => {
    const record = doc(db, "workforce_attendance", id),
      history = doc(db, "workforce_attendance_history", operationId);
    const [previous, event] = await Promise.all([
      tx.get(record),
      tx.get(history),
    ]);
    if (event.exists()) {
      if (
        event.data().fingerprint !== fingerprint ||
        event.data().actor !== String(user.id)
      )
        throw Error("Reintento incompatible.");
      return;
    }
    if ((previous.data()?.revision ?? 0) !== expectedRevision)
      throw Error(
        "Otra persona actualizó la asistencia. Actualiza antes de guardar.",
      );
    const payload = {
      ...row,
      weekStart,
      day: Timestamp.fromDate(new Date(`${row.date}T00:00:00Z`)),
      week: Timestamp.fromDate(new Date(`${weekStart}T00:00:00Z`)),
      revision: expectedRevision + 1,
      lastOperationId: operationId,
      updatedBy: String(user.id),
      updatedAt: serverTimestamp(),
    };
    tx.set(record, payload);
    tx.set(history, {
      workerId: row.workerId,
      date: row.date,
      recordId: id,
      revision: payload.revision,
      actor: String(user.id),
      actorLabel: user.first_name || user.role_label || "Cuenta autorizada",
      reason: reason.trim(),
      fingerprint,
      record: payload,
      createdAt: serverTimestamp(),
    });
  });
}
