"use client";
import { BusyIndicator } from "@/components/farm-loader";
import { useRef, useState } from "react";
import {
  CalendarCheck,
  UserX,
  Clock3,
  Save,
  History,
  Download,
  LogIn,
  LogOut,
  Search,
} from "lucide-react";
import { PrivatePhoto } from "./private-photo";
import { Modal, fincaDate } from "./firebase-workforce-board";
import { fullName, text } from "@/lib/firebase-models";
import type { CloudRow } from "@/lib/firebase-client";
import type { AuthUser } from "@/types/auth";
import {
  attendanceStates,
  isAbsence,
  workedMinutes,
  weekFor,
  saveAttendance,
  attendanceHistory,
  type AttendancePlan,
} from "@/lib/firebase-attendance";
const timeNow = () =>
  new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Managua",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date());
const duration = (n: number | null) =>
  n === null
    ? "Pendiente de cierre"
    : n < 0
      ? "Revisar horario"
      : `${Math.floor(n / 60)} h ${n % 60} min`;
export function FirebaseAttendanceBoard({
  user,
  workers,
  rows,
  payrolls,
  changed,
}: {
  user: AuthUser;
  workers: CloudRow[];
  rows: CloudRow[];
  payrolls: CloudRow[];
  changed(): Promise<void>;
}) {
  const [date, setDate] = useState(fincaDate()),
    [search, setSearch] = useState(""),
    [view, setView] = useState("day"),
    [mode, setMode] = useState<"automatic" | "manual">("automatic"),
    [editor, setEditor] = useState<{
      plan: AttendancePlan;
      revision: number;
    } | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [events, setEvents] = useState<CloudRow[] | null>(null);
  const locked = useRef(false),
    pending = useRef(new Map<string, string>());
  const canEdit = ["ADMIN", "MANAGER", "SUPERVISOR"].includes(user.role);
  const find = (workerId: string, day = date) =>
    rows.find((r) => r.workerId === workerId && r.date === day);
  const draft = (w: CloudRow, row?: CloudRow): AttendancePlan => ({
    workerId: w.id,
    date: row ? text(row.date) : date,
    status: (text(row?.status) || "present") as AttendancePlan["status"],
    arrival: text(row?.arrival),
    departure: text(row?.departure),
    nextDay: row?.nextDay === true,
    breakMinutes: Number(row?.breakMinutes) || 0,
    justified: row?.justified === true,
    note: text(row?.note),
  });
  const isClosed = (day: string) =>
    payrolls.some((p) => p.id === weekFor(day) || p.weekStart === weekFor(day));
  const filtered = workers.filter((w) =>
    fullName(w).toLowerCase().includes(search.toLowerCase()),
  );
  const selected = rows
    .filter((r) =>
      view === "day"
        ? r.date === date
        : view === "week"
          ? weekFor(text(r.date)) === weekFor(date)
          : true,
    )
    .filter((r) => filtered.some((w) => w.id === r.workerId))
    .sort((a, b) => text(b.date).localeCompare(text(a.date)));
  async function save(
    plan: AttendancePlan,
    revision: number,
    reason: string,
    close = false,
  ) {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    const key = JSON.stringify({ plan, revision, reason });
    const id = pending.current.get(key) ?? crypto.randomUUID();
    pending.current.set(key, id);
    try {
      await saveAttendance(user, plan, revision, id, reason);
      await changed();
      pending.current.delete(key);
      if (close) setEditor(null);
      setNotice("Asistencia guardada y confirmada por el servidor.");
    } catch (e) {
      setError(
        e instanceof Error && !e.message.includes("Firebase")
          ? e.message
          : "No se confirmó el registro. El período puede estar cerrado, o faltar conexión/permisos. Actualiza antes de reintentar.",
      );
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  function quick(w: CloudRow, action: "present" | "absent" | "arrival" | "departure") {
    const row = find(w.id),
      plan = draft(w, row);
    if (action === "present") plan.status = "present";
    if (action === "absent") {
      if (plan.arrival || plan.departure) {
        setError("Este registro ya tiene horas. Usa Detalles y correcciones para cambiarlo a ausencia.");
        return;
      }
      plan.status = "absent";
      plan.breakMinutes = 0;
      plan.nextDay = false;
    }
    if (action === "arrival") {
      plan.arrival = timeNow();
      if (isAbsence(plan.status)) plan.status = "present";
    }
    if (action === "departure") plan.departure = timeNow();
    void save(
      plan,
      row?.operationalRevision ? Number(row.revision) : 0,
      action === "present"
        ? "Marcación de presencia"
        : action === "absent"
          ? "Marcación de ausencia"
        : action === "arrival"
          ? "Entrada registrada ahora"
          : "Salida registrada ahora",
    );
  }
  function exportCsv() {
    const quote = (v: unknown) =>
      '"' +
      String(v ?? "")
        .replace(/^[=+@-]/, "'$&")
        .replaceAll('"', '""') +
      '"';
    const lines = [
      [
        "Fecha",
        "Trabajador",
        "Estado",
        "Entrada",
        "Salida",
        "Descanso (min)",
        "Tiempo neto (min)",
        "Justificada",
        "Nota",
      ],
      ...selected.map((r) => [
        r.date,
        fullName(workers.find((w) => w.id === r.workerId)!),
        attendanceStates[r.status as keyof typeof attendanceStates],
        r.arrival,
        r.departure,
        r.breakMinutes ?? 0,
        workedMinutes({
          ...r,
          arrival: text(r.arrival),
          departure: text(r.departure),
          nextDay: r.nextDay === true,
          breakMinutes: Number(r.breakMinutes) || 0,
        }) ?? "",
        r.justified ? "Sí" : "No",
        r.note,
      ]),
    ];
    const url = URL.createObjectURL(
      new Blob(
        [
          "\uFEFF" +
            lines.map((line) => line.map(quote).join(",")).join("\r\n"),
        ],
        { type: "text/csv;charset=utf-8" },
      ),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `asistencia-${date}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <div className="mt-6 space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <input
          aria-label="Fecha de asistencia"
          type="date"
          max={fincaDate()}
          value={date}
          onChange={(e) => {
            if (e.target.value) setDate(e.target.value);
          }}
          className="f-input"
        />
        <button className="f-button" onClick={() => setDate(fincaDate())}>
          Hoy
        </button>
        <select
          aria-label="Vista de asistencia"
          className="f-input"
          value={view}
          onChange={(e) => setView(e.target.value)}
        >
          <option value="day">Registro diario</option>
          <option value="week">Resumen semanal</option>
          <option value="history">Historial completo</option>
        </select>
        <label className="flex w-full min-w-0 basis-full items-center gap-2 sm:w-auto sm:basis-48 sm:flex-1">
          <Search size={16} />
          <input
            aria-label="Buscar trabajador"
            placeholder="Buscar trabajador…"
            className="f-input w-full"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <button className="f-button" onClick={exportCsv}>
          <Download size={15} />
          Exportar CSV
        </button>
      </div>
      {canEdit && <fieldset className="flex flex-wrap items-center gap-3">
        <legend className="sr-only">Modo de registro</legend>
        <span className="text-sm font-semibold">Horas:</span>
        <div className="flex flex-wrap gap-2">
          <button className={`f-button ${mode === "automatic" ? "f-primary" : ""}`} aria-pressed={mode === "automatic"} onClick={() => setMode("automatic")}>Automático</button>
          <button className={`f-button ${mode === "manual" ? "f-primary" : ""}`} aria-pressed={mode === "manual"} onClick={() => setMode("manual")}>Manual</button>
        </div>
        <span className="text-xs text-neutral-500">{mode === "automatic" ? "Hora actual de Nicaragua" : "Escribe y guarda las horas"}</span>
      </fieldset>}
      {error && (
        <p
          role="alert"
          className="rounded-xl bg-red-50 p-4 text-sm text-red-800"
        >
          {error}
        </p>
      )}
      {notice && (
        <p
          role="status"
          className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800"
        >
          {notice}
        </p>
      )}
      {busy && <p role="status" className="flex items-center gap-2 text-sm text-emerald-700"><BusyIndicator /> Guardando asistencia…</p>}
      {isClosed(date) && (
        <p role="status" className="surface-card p-4 text-sm">
          Período cerrado: asistencia protegida contra cambios.
        </p>
      )}
      {view === "day" && <p className="text-sm text-neutral-500">
        {filtered.filter((w) => w.status === "active" && find(w.id) && !isAbsence(text(find(w.id)?.status))).length} presentes · {filtered.filter((w) => w.status === "active" && isAbsence(text(find(w.id)?.status))).length} ausentes · {filtered.filter((w) => w.status === "active" && !find(w.id)).length} sin marcar
      </p>}
      {view === "day" ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered
            .filter((w) => w.status === "active" || find(w.id))
            .map((w) => {
              const row = find(w.id),
                plan = draft(w, row),
                disabled = busy || isClosed(date) || w.status !== "active";
              return (
                <article className="surface-card p-5" key={w.id}>
                  <div className="flex flex-wrap items-start gap-3">
                    <PrivatePhoto source={w.photoUrl} name={fullName(w)} large />
                    <div className="min-w-0 flex-1">
                      <h2 className="font-semibold">{fullName(w)}</h2>
                      <p className="mt-1 text-xs text-neutral-500">
                        {text(w.area)}
                        {w.status !== "active" ? " · Inactivo" : ""}
                      </p>
                    </div>
                    <span
                      className={`rounded-md px-2 py-1 text-[11px] font-semibold ${isAbsence(plan.status) ? "bg-red-50 text-red-700" : row ? "bg-emerald-50 text-emerald-700" : "bg-neutral-100 text-neutral-500"}`}
                    >
                      {row ? attendanceStates[plan.status] : "Sin marcar"}
                    </span>
                  </div>
                  <dl className="mt-5 grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <dt className="text-xs text-neutral-500">Entrada</dt>
                      <dd className="mt-1 font-semibold tabular-nums">
                        {plan.arrival || "—"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-neutral-500">Salida</dt>
                      <dd className="mt-1 font-semibold tabular-nums">
                        {plan.departure || "—"}
                        {plan.nextDay ? " (+1 día)" : ""}
                      </dd>
                    </div>
                  </dl>
                  <p className="mt-4 flex items-center gap-2 text-xs text-neutral-500">
                    <Clock3 size={14} />
                    {isAbsence(plan.status) ? "No aplica (ausencia)" : plan.arrival && !plan.departure ? "Incidencia: salida pendiente" : duration(workedMinutes(plan))} · descanso{" "}
                    {plan.breakMinutes} min
                  </p>
                  {plan.note && <p className="mt-3 text-xs">{plan.note}</p>}
                  {canEdit && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {(!row || isAbsence(plan.status)) && (
                        <button
                          disabled={disabled}
                          className="f-button f-primary"
                          onClick={() => quick(w, "present")}
                        >
                          <CalendarCheck size={14} />
                          Presente
                        </button>
                      )}
                      {!isAbsence(plan.status) && (
                        <button disabled={disabled || !!plan.arrival || !!plan.departure} className="f-button" onClick={() => quick(w, "absent")} title={plan.arrival || plan.departure ? "Usa Detalles y correcciones para cambiar una jornada con horas" : undefined}>
                          <UserX size={14} /> Ausente
                        </button>
                      )}
                      {mode === "automatic" && (
                        <>
                          <button disabled={disabled || date !== fincaDate() || !!plan.arrival} className="f-button" onClick={() => quick(w, "arrival")}>
                            <LogIn size={14} />{plan.arrival ? "Entrada registrada" : "Registrar entrada ahora"}
                          </button>
                          <button disabled={disabled || date !== fincaDate() || !plan.arrival || !!plan.departure} className="f-button" onClick={() => quick(w, "departure")}>
                            <LogOut size={14} />{plan.departure ? "Salida registrada" : "Registrar salida ahora"}
                          </button>
                        </>
                      )}
                      {mode === "manual" && <ManualHours key={`${w.id}-${date}-${row?.revision ?? 0}`} plan={plan} disabled={disabled} onSave={(value) => save(value, row?.operationalRevision ? Number(row.revision) : 0, "Registro manual de horas")} />}
                    </div>
                  )}
                  <details className="mt-4 text-xs text-neutral-500">
                    <summary className="min-h-8 font-semibold">Más opciones</summary>
                    <div className="mt-2 flex flex-wrap gap-2">
                    {canEdit && <button disabled={disabled} className="f-button" onClick={() => {
                      setError("");
                      setEditor({ plan, revision: row?.operationalRevision ? Number(row.revision) : 0 });
                    }}>Detalles y correcciones</button>}
                  <button
                    className="f-button"
                    disabled={busy}
                    onClick={() =>
                      void attendanceHistory(user, w.id, date)
                        .then(setEvents)
                        .catch(() =>
                          setError("No se pudo consultar el historial."),
                        )
                    }
                  >
                    <History size={14} />
                    Ver revisiones
                  </button>
                    </div>
                  </details>
                </article>
              );
            })}
        </div>
      ) : (
        <div className="surface-card overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr>
                {[
                  "Fecha",
                  "Trabajador",
                  "Estado",
                  "Entrada",
                  "Salida",
                  "Descanso",
                  "Tiempo neto",
                  "Justificada",
                  "Nota",
                ].map((h) => (
                  <th key={h} className="whitespace-nowrap p-3">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {selected.map((row) => {
                const plan = draft(
                  workers.find((w) => w.id === row.workerId)!,
                  row,
                );
                return (
                  <tr key={row.id} className="border-t border-neutral-200">
                    <td className="p-3">{text(row.date)}</td>
                    <td className="p-3">
                      {fullName(workers.find((w) => w.id === row.workerId)!)}
                    </td>
                    <td className="p-3">{attendanceStates[plan.status]}</td>
                    <td className="p-3">{plan.arrival || "—"}</td>
                    <td className="p-3">
                      {plan.departure || "—"}
                      {plan.nextDay ? " (+1)" : ""}
                    </td>
                    <td className="p-3">{plan.breakMinutes} min</td>
                    <td className="whitespace-nowrap p-3">
                      {isAbsence(plan.status) ? "No aplica (ausencia)" : duration(workedMinutes(plan))}
                    </td>
                    <td className="p-3">{plan.justified ? "Sí" : "No"}</td>
                    <td className="p-3">{plan.note}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!selected.length && (
            <p className="p-5 text-sm text-neutral-500">
              No hay asistencia para estos filtros.
            </p>
          )}
        </div>
      )}
      {editor && (
        <Modal
          title="Registrar asistencia"
          close={() => {
            if (!busy) setEditor(null);
          }}
        >
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              void save(
                editor.plan,
                editor.revision,
                String(f.get("reason") || "Registro de asistencia"),
                true,
              );
            }}
          >
            <p className="text-sm font-semibold">
              {fullName(workers.find((w) => w.id === editor.plan.workerId)!)} ·{" "}
              {editor.plan.date}
            </p>
            <label className="grid gap-2 text-xs">
              Estado
              <select
                aria-label="Estado de asistencia"
                className="f-input"
                value={editor.plan.status}
                onChange={(e) =>
                  setEditor({
                    ...editor,
                    plan: {
                      ...editor.plan,
                      status: e.target.value as AttendancePlan["status"],
                      ...(isAbsence(e.target.value)
                        ? {
                            arrival: "",
                            departure: "",
                            breakMinutes: 0,
                            nextDay: false,
                          }
                        : {}),
                    },
                  })
                }
              >
                {Object.entries(attendanceStates).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-3">
              {(["arrival", "departure"] as const).map((key) => (
                <label key={key} className="grid gap-2 text-xs">
                  {key === "arrival" ? "Hora de entrada" : "Hora de salida"}
                  <input
                    type="time"
                    aria-label={
                      key === "arrival" ? "Hora de entrada" : "Hora de salida"
                    }
                    disabled={isAbsence(editor.plan.status)}
                    className="f-input"
                    value={editor.plan[key]}
                    onChange={(e) =>
                      setEditor({
                        ...editor,
                        plan: { ...editor.plan, [key]: e.target.value },
                      })
                    }
                  />
                </label>
              ))}
            </div>
            <label className="grid gap-2 text-xs">
              Descanso no trabajado (minutos)
              <input
                aria-label="Minutos de descanso"
                disabled={isAbsence(editor.plan.status)}
                className="f-input"
                type="number"
                min="0"
                max="240"
                step="1"
                value={editor.plan.breakMinutes}
                onChange={(e) =>
                  setEditor({
                    ...editor,
                    plan: {
                      ...editor.plan,
                      breakMinutes: Number(e.target.value),
                    },
                  })
                }
              />
            </label>
            <label className="flex min-h-10 items-center gap-2 text-sm">
              <input
                type="checkbox"
                disabled={isAbsence(editor.plan.status)}
                checked={editor.plan.nextDay}
                onChange={(e) =>
                  setEditor({
                    ...editor,
                    plan: { ...editor.plan, nextDay: e.target.checked },
                  })
                }
              />
              La salida corresponde al día siguiente
            </label>
            <label className="flex min-h-10 items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={editor.plan.justified}
                onChange={(e) =>
                  setEditor({
                    ...editor,
                    plan: { ...editor.plan, justified: e.target.checked },
                  })
                }
              />
              Ausencia o llegada tarde justificada
            </label>
            <label className="grid gap-2 text-xs">
              Observaciones
              <textarea
                aria-label="Observaciones de asistencia"
                maxLength={500}
                className="f-input"
                value={editor.plan.note}
                onChange={(e) =>
                  setEditor({
                    ...editor,
                    plan: { ...editor.plan, note: e.target.value },
                  })
                }
              />
            </label>
            <label className="grid gap-2 text-xs">
              Motivo del registro o corrección
              <input
                name="reason"
                aria-label="Motivo del registro"
                required
                maxLength={500}
                defaultValue={editor.revision ? "" : "Registro diario"}
                className="f-input"
              />
            </label>
            <p className="text-xs text-neutral-500">
              Tiempo neto: {isAbsence(editor.plan.status) ? "No aplica (ausencia)" : duration(workedMinutes(editor.plan))}. Los registros
              originales e historial se conservan.
            </p>
            {error && (
              <p role="alert" className="text-sm text-red-700">
                {error}
              </p>
            )}
            <button disabled={busy} className="f-button f-primary">
              <Save size={16} />
              {busy ? "Guardando…" : "Guardar asistencia"}
            </button>
          </form>
        </Modal>
      )}
      {events && (
        <Modal title="Revisiones de asistencia" close={() => setEvents(null)}>
          <ol className="space-y-4">
            {events.map((event) => {
              const record = event.record as AttendancePlan;
              const previous = event.previousValue as AttendancePlan | null | undefined;
              return (
                <li
                  key={event.id}
                  className="rounded-xl border border-neutral-200 p-4 text-xs"
                >
                  <p className="font-semibold">
                    Revisión {Number(event.revision)} · {text(event.actorLabel)}
                  </p>
                  <p className="mt-2">
                    {attendanceStates[record.status]} · {record.arrival || "—"}{" "}
                    → {record.departure || "—"}
                  </p>
                  {previous && <p className="mt-2">Antes: {previous.arrival || "—"} → {previous.departure || "—"} · Ahora: {record.arrival || "—"} → {record.departure || "—"}</p>}
                  <p className="mt-2">{text(event.reason)}</p>
                </li>
              );
            })}
            {!events.length && (
              <li className="text-sm text-neutral-500">
                Sin revisiones nuevas. Los registros originales se conservan en
                el historial de asistencia.
              </li>
            )}
          </ol>
        </Modal>
      )}
    </div>
  );
}

function ManualHours({ plan, disabled, onSave }: { plan: AttendancePlan; disabled: boolean; onSave(value: AttendancePlan): Promise<void> }) {
  const [arrival, setArrival] = useState(plan.arrival);
  const [departure, setDeparture] = useState(plan.departure);
  const [nextDay, setNextDay] = useState(plan.nextDay);
  return <form className="w-full space-y-3 rounded-xl border border-neutral-200 p-3" onSubmit={(event) => {
    event.preventDefault();
    void onSave({ ...plan, arrival, departure, nextDay, status: arrival && isAbsence(plan.status) ? "present" : plan.status });
  }}>
    <div className="grid grid-cols-2 gap-3">
      <label className="text-xs">Hora de entrada<input aria-label="Entrada manual" className="f-input mt-1 w-full" type="time" value={arrival} disabled={disabled} onChange={(e) => { setArrival(e.target.value); if (!e.target.value) setNextDay(false); }} /></label>
      <label className="text-xs">Hora de salida<input aria-label="Salida manual" className="f-input mt-1 w-full" type="time" value={departure} disabled={disabled} onChange={(e) => { setDeparture(e.target.value); if (!e.target.value) setNextDay(false); }} /></label>
    </div>
    <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={nextDay} disabled={disabled || !arrival || !departure} onChange={(e) => setNextDay(e.target.checked)} />Salida al día siguiente</label>
    <p className="text-xs text-neutral-500">Descanso: {plan.breakMinutes} min · Ajusta descansos y observaciones en Detalles y correcciones.</p>
    <button className="f-button f-primary" disabled={disabled || (!arrival && !departure)} type="submit"><Save size={14} />Guardar horas</button>
  </form>;
}
