import { collection, doc, getDocFromServer, getDocsFromServer, runTransaction, serverTimestamp } from "firebase/firestore";
import { firebaseClient } from "@/lib/firebase-client";
import { workerBinding } from "@/lib/firebase-workforce";
import type { AuthUser } from "@/types/auth";

export type CompetencyLevel = "autonomous" | "supervised";
export type CompetencyProfile = {
  workerId: string;
  competencies: Record<string, CompetencyLevel>;
  revision: number;
  lastOperationId: string;
  updatedBy: string;
  updatedAt?: unknown;
};

export function validateCompetencies(competencies: Record<string, CompetencyLevel>) {
  const entries = Object.entries(competencies);
  if (entries.length > 100) throw Error("Puedes registrar hasta 100 actividades por persona.");
  const normalized = new Set<string>();
  for (const [activity, level] of entries) {
    if (activity.trim() !== activity || !activity || activity.length > 120 || /[\u0000-\u001f]/.test(activity))
      throw Error("Cada actividad debe tener entre 1 y 120 caracteres válidos.");
    if (!["autonomous", "supervised"].includes(level)) throw Error("Nivel de autonomía inválido.");
    const key = activity.normalize("NFKC").toLocaleLowerCase("es");
    if (normalized.has(key)) throw Error("No repitas actividades con el mismo nombre.");
    normalized.add(key);
  }
}

export async function readCompetencyProfile(workerId: string): Promise<CompetencyProfile | null> {
  const { db } = await firebaseClient();
  const snapshot = await getDocFromServer(doc(db, "workforce_profiles", workerId));
  return snapshot.exists() ? snapshot.data() as CompetencyProfile : null;
}

export async function readCompetencyProfiles(user: AuthUser): Promise<CompetencyProfile[]> {
  if (user.role === "WORKER") {
    const workerId = await workerBinding(user);
    if (!workerId) return [];
    const profile = await readCompetencyProfile(workerId);
    return profile ? [profile] : [];
  }
  if (!["ADMIN", "MANAGER", "SUPERVISOR"].includes(user.role)) throw Error("Perfil no autorizado.");
  const { db } = await firebaseClient();
  const result = await getDocsFromServer(collection(db, "workforce_profiles"));
  return result.docs.map((snapshot) => snapshot.data() as CompetencyProfile);
}

export async function saveCompetencies(
  user: AuthUser,
  workerId: string,
  competencies: Record<string, CompetencyLevel>,
  expectedRevision: number,
  operationId: string,
  reason: string,
) {
  if (!["ADMIN", "MANAGER", "SUPERVISOR"].includes(user.role)) throw Error("Solo un encargado puede editar competencias.");
  validateCompetencies(competencies);
  if (!workerId || !operationId || !reason.trim() || reason.length > 500) throw Error("Datos de revisión inválidos.");
  const { db } = await firebaseClient();
  await runTransaction(db, async (tx) => {
    const profileRef = doc(db, "workforce_profiles", workerId);
    const eventRef = doc(db, "workforce_profile_history", operationId);
    const [profile, event] = await Promise.all([tx.get(profileRef), tx.get(eventRef)]);
    if (event.exists()) {
      const previous = event.data();
      const recorded = previous.competencies as Record<string, string>;
      if (previous.workerId !== workerId || previous.revision !== expectedRevision + 1 || previous.actor !== String(user.id) || previous.reason !== reason.trim() || Object.keys(recorded).length !== Object.keys(competencies).length || Object.entries(competencies).some(([activity, level]) => recorded[activity] !== level))
        throw Error("Reintento incompatible.");
      return;
    }
    const old = profile.data();
    if ((old?.revision ?? 0) !== expectedRevision) throw Error("Las competencias cambiaron. Actualiza y vuelve a intentar.");
    const revision = expectedRevision + 1;
    tx.set(profileRef, { workerId, competencies, revision, lastOperationId: operationId, updatedBy: String(user.id), updatedAt: serverTimestamp() });
    tx.set(eventRef, { workerId, competencies, previousCompetencies: old?.competencies ?? {}, revision, actor: String(user.id), reason: reason.trim(), createdAt: serverTimestamp() });
  });
}
