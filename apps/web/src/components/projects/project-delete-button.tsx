"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { deleteProject, ProjectApiError } from "@/lib/project-api";

export function ProjectDeleteButton({ id }: { id: number }) {
  const router = useRouter(); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  async function remove() {
    if (!window.confirm("¿Eliminar este proyecto? Solo es posible si no tiene operaciones asociadas.")) return;
    setBusy(true); setError("");
    try { await deleteProject(id); router.replace("/dashboard/projects"); router.refresh(); }
    catch (reason) { setError(reason instanceof ProjectApiError ? reason.message : "No se pudo eliminar."); setBusy(false); }
  }
  return <div><button type="button" onClick={remove} disabled={busy} className="min-h-11 rounded-xl border border-red-200 bg-white px-4 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50">{busy ? "Eliminando…" : "Eliminar proyecto"}</button>{error ? <p role="alert" className="mt-2 text-sm text-red-700">{error}</p> : null}</div>;
}
