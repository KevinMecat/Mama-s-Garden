"use client";

import { useRef, useState, type FormEvent } from "react";
import { readCompetencyProfile, saveCompetencies, type CompetencyLevel, type CompetencyProfile } from "@/lib/firebase-competencies";
import type { AuthUser } from "@/types/auth";

export function CompetencyProfileView({ user, workerId }: { user: AuthUser; workerId: string }) {
  const [profile, setProfile] = useState<CompetencyProfile | null>();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [activity, setActivity] = useState("");
  const [level, setLevel] = useState<CompetencyLevel>("autonomous");
  const operation = useRef(new Map<string, string>());
  const edit = ["ADMIN", "MANAGER", "SUPERVISOR"].includes(user.role);

  async function refresh() {
    setBusy(true);
    setMessage("");
    try { setProfile(await readCompetencyProfile(workerId)); }
    catch { setMessage("No se pudieron consultar las competencias. Comprueba tu conexión."); }
    finally { setBusy(false); }
  }
  async function change(name: string, nextLevel: CompetencyLevel | "none") {
    if (busy || profile === undefined) return;
    const next = { ...(profile?.competencies ?? {}) };
    if (nextLevel === "none") delete next[name];
    else next[name] = nextLevel;
    const reason = "Actualización de competencias";
    const expectedRevision = profile?.revision ?? 0;
    const key = JSON.stringify({ workerId, next, expectedRevision, reason });
    const id = operation.current.get(key) ?? crypto.randomUUID();
    operation.current.set(key, id);
    setBusy(true);
    setMessage("");
    try {
      await saveCompetencies(user, workerId, next, expectedRevision, id, reason);
      const saved = await readCompetencyProfile(workerId);
      setProfile(saved);
      operation.current.delete(key);
      setActivity("");
      setMessage("Competencias guardadas.");
    } catch (error) {
      setMessage(error instanceof Error && !error.message.includes("Firebase") ? error.message : "No se confirmó el cambio. Actualiza antes de reintentar.");
    } finally { setBusy(false); }
  }
  function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = activity.trim();
    if (name) void change(name, level);
  }
  return (
    <details className="mt-4 border-t border-neutral-100 pt-3 text-xs" onToggle={(event) => { if (event.currentTarget.open && profile === undefined && !busy) void refresh(); }}>
      <summary className="min-h-8 font-semibold text-emerald-700">Competencias por actividad</summary>
      {busy && <p role="status" className="mt-2">Consultando o guardando…</p>}
      {message && <p role="status" className="mt-2">{message}</p>}
      {profile !== undefined && (
        <>
          {Object.entries(profile?.competencies ?? {}).length === 0 && <p className="mt-2 text-neutral-500">Sin competencias registradas. Una actividad no registrada no se considera asignable.</p>}
          <ul className="mt-2 space-y-2">
            {Object.entries(profile?.competencies ?? {}).map(([name, value]) => (
              <li key={name} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-neutral-200 p-2">
                <span className="font-medium">{name}</span>
                {edit ? <select className="f-input" aria-label={`Competencia ${name}`} disabled={busy} value={value} onChange={(event) => void change(name, event.target.value as CompetencyLevel | "none")}>
                  <option value="autonomous">Autónomo</option><option value="supervised">Requiere acompañamiento</option><option value="none">No asignable</option>
                </select> : <span>{value === "autonomous" ? "Autónomo" : "Requiere acompañamiento"}</span>}
              </li>
            ))}
          </ul>
          {edit && <form className="mt-3 flex flex-wrap gap-2" onSubmit={add}>
            <input className="f-input min-w-0 flex-1" aria-label="Nombre de actividad" placeholder="Actividad, por ejemplo poda" value={activity} maxLength={120} required disabled={busy} onChange={(event) => setActivity(event.target.value)} />
            <select className="f-input" aria-label="Nivel de autonomía" value={level} disabled={busy} onChange={(event) => setLevel(event.target.value as CompetencyLevel)}><option value="autonomous">Autónomo</option><option value="supervised">Requiere acompañamiento</option></select>
            <button className="f-button f-primary" disabled={busy} type="submit">Guardar actividad</button>
          </form>}
        </>
      )}
      {message && <button type="button" className="mt-2 underline" disabled={busy} onClick={() => void refresh()}>Actualizar competencias</button>}
    </details>
  );
}
