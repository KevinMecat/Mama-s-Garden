"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { deriveProjectRiskEvidence, selectOperationalAlerts, type AlertInput } from "@/lib/workforce-alerts";
import { readProjectGraph, type ProjectGraph } from "@/lib/firebase-project-graph";

export function OperationalAlerts({ input, onOpenTask, canReadProjectGraphs = false }: { input: AlertInput; onOpenTask(id: string): void; canReadProjectGraphs?: boolean }) {
  const [gapHours, setGapHours] = useState(1.5);
  const [graphResult, setGraphResult] = useState<{ key: string; graphs: ProjectGraph[]; failed: number }>();
  const projectIds = JSON.stringify([...new Set(input.tasks.map((task) => task.project).filter(Boolean))].sort());
  const graphKey = JSON.stringify([projectIds, input.tasks.map((task) => [task.id, task.project, task.revision])]);
  useEffect(() => {
    if (!canReadProjectGraphs) return;
    let active = true;
    const ids = JSON.parse(projectIds) as string[];
    void Promise.allSettled(ids.map(readProjectGraph)).then((results) => {
      if (!active) return;
      setGraphResult({ key: graphKey, graphs: results.flatMap((result) => result.status === "fulfilled" ? [result.value] : []), failed: results.filter((result) => result.status === "rejected").length });
    });
    return () => { active = false; };
  }, [canReadProjectGraphs, graphKey, projectIds]);
  const currentGraphs = canReadProjectGraphs && graphResult?.key === graphKey ? graphResult : undefined;
  const projectRisks = currentGraphs ? deriveProjectRiskEvidence(input, currentGraphs.graphs) : undefined;
  const alerts = selectOperationalAlerts({ ...input, gapHours, ...(projectRisks ? { criticalTaskIds: projectRisks.criticalTaskIds, resourceRiskTaskIds: projectRisks.resourceRiskTaskIds, resourceRiskEvidence: projectRisks.resourceRiskEvidence } : {}) });
  return <section aria-labelledby="operational-alerts-title" className="surface-card mt-6 p-4 sm:p-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 id="operational-alerts-title" className="flex items-center gap-2 font-semibold"><AlertTriangle size={17} /> Alertas operativas <span className="text-xs text-neutral-500">({alerts.length})</span></h2>
      <label className="flex items-center gap-2 text-xs text-neutral-500">Umbral de diferencia (horas)<input aria-label="Umbral de diferencia de horas" type="number" min="0" max="24" step="0.25" value={gapHours} onChange={(event) => { const value = event.target.valueAsNumber; if (Number.isFinite(value) && value >= 0 && value <= 24) setGapHours(value); }} className="f-input w-20" /></label>
    </div>
    {canReadProjectGraphs && (!currentGraphs || currentGraphs.failed > 0 || !!projectRisks?.unavailableProjectIds.length) && <p className="mt-3 text-xs text-neutral-500">{!currentGraphs ? "Consultando riesgos de proyectos…" : "Algunas rutas no pudieron evaluarse; revisa sus duraciones y dependencias."}</p>}
    {!alerts.length ? <p className="mt-3 text-sm text-neutral-500">Sin alertas con los datos cargados para la fecha seleccionada.</p> : <ul className="mt-4 grid gap-3 md:grid-cols-2">{alerts.map((item) => <li key={item.id} className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 text-sm text-neutral-800">
      <h3 className="font-semibold">{item.title}</h3><p className="mt-1 text-xs">{item.evidence}</p><p className="mt-2 text-xs text-neutral-600">{item.review}</p>
      {item.action.kind === "task" && item.action.id ? <button type="button" className="f-button mt-3" onClick={() => onOpenTask(item.action.id!)}>{item.action.label}</button> : <Link className="f-button mt-3" href={item.action.kind === "attendance" ? "/dashboard/attendance" : item.action.id ?? "/dashboard/projects"}>{item.action.label}</Link>}
    </li>)}</ul>}
  </section>;
}
