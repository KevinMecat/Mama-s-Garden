"use client";

import Link from "next/link";
import { GripVertical } from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  workforce,
  type Options,
  type State,
  type Task,
  type TaskPage,
} from "@/lib/workforce-api";

type Mode = "board" | "close" | "history";
type Action =
  | "create"
  | "edit"
  | "submit"
  | "time"
  | "accept"
  | "return"
  | "block"
  | "cancel"
  | "duplicate"
  | "detail";
const states: [State, string][] = [
  ["TODO", "Por hacer"],
  ["IN_PROGRESS", "En curso"],
  ["REVIEW", "Por revisar"],
  ["DONE", "Finalizado"],
];
const priority: Record<string, string> = {
  LOW: "Baja",
  NORMAL: "Normal",
  HIGH: "Alta",
};
const button =
  "min-h-11 rounded-xl border border-brand-border bg-white px-4 py-2 text-sm font-semibold text-brand-ink hover:bg-brand-cream disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary";
const primaryButton = button
  .replace("bg-white", "bg-brand-primary")
  .replace("text-brand-ink", "text-white")
  .replace("hover:bg-brand-cream", "hover:bg-brand-secondary");
const input =
  "mt-1 min-h-11 w-full rounded-xl border border-brand-border bg-white px-3 py-2 text-base text-brand-ink";
function today() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Guatemala",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function WorkforceView({ mode }: { mode: Mode }) {
  const [options, setOptions] = useState<Options>();
  const [data, setData] = useState<TaskPage>();
  const [date, setDate] = useState(mode === "history" ? "" : today);
  const [employee, setEmployee] = useState("");
  const [project, setProject] = useState("");
  const [page, setPage] = useState(1);
  const [version, setVersion] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const retry = useRef<{ signature: string; key: string } | null>(null);
  const [dialog, setDialog] = useState<{ action: Action; task?: Task }>();
  const [mobileState, setMobileState] = useState<State>("TODO");
  const [dragged, setDragged] = useState<number>();
  const refresh = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const query = new URLSearchParams({ page: String(page) });
    if (date) query.set(mode === "close" ? "work_date" : "date", date);
    if (employee) query.set("employee", employee);
    if (project) query.set("project", project);
    Promise.all([
      workforce<Options>("options_data/", undefined, "GET", controller.signal),
      workforce<TaskPage>(`?${query}`, undefined, "GET", controller.signal),
    ])
      .then(([opts, tasks]) => {
        if (active) {
          setOptions(opts);
          setData(tasks);
          setError("");
          setLoading(false);
        }
      })
      .catch((failure: unknown) => {
        if (active) {
          setError(
            failure instanceof Error ? failure.message : "No se pudo conectar.",
          );
          setLoading(false);
        }
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [date, employee, project, page, version, mode]);

  async function mutate(
    route: string,
    body: Record<string, unknown>,
    method = "POST",
  ) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    const signature = JSON.stringify({ route, body, method });
    if (retry.current?.signature !== signature)
      retry.current = { signature, key: crypto.randomUUID() };
    try {
      await workforce(route, { ...body, key: retry.current.key }, method);
      retry.current = null;
      setDialog(undefined);
      setNotice("Cambio guardado.");
      setLoading(true);
      refresh();
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Error de conexión. Puedes reintentar sin duplicar registros.",
      );
      // No optimistic movement: the card always keeps the last server-confirmed state.
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  function run(task: Task, action: string) {
    return mutate(`${task.id}/command/`, { revision: task.revision, action });
  }
  function filter(set: (value: string) => void, value: string) {
    set(value);
    setPage(1);
    setData(undefined);
    setLoading(true);
  }
  function drop(state: State) {
    const task = data?.results.find((item) => item.id === dragged);
    setDragged(undefined);
    if (!task || busy || loading || state === task.state) return;
    if (task.state === "TODO" && state === "IN_PROGRESS")
      void run(task, "start");
    else if (task.state === "IN_PROGRESS" && state === "REVIEW")
      setDialog({ action: "submit", task });
    else if (
      task.state === "REVIEW" &&
      state === "DONE" &&
      options?.administrator
    )
      setDialog({ action: "accept", task });
    else if (
      task.state === "REVIEW" &&
      state === "IN_PROGRESS" &&
      options?.administrator
    )
      setDialog({ action: "return", task });
    else
      setError(
        "Movimiento no permitido. Usa los botones de la tarjeta para completar el flujo.",
      );
  }
  const tasks = data?.results ?? [];
  const manager = options?.administrator ?? false;

  function card(task: Task) {
    const dailyLog = task.work_logs
      .filter((log) => log.work_date === date)
      .at(-1);
    return (
      <article
        key={task.id}
        draggable={
          !busy && !loading && !task.cancelled_at && !task.blocked_reason
        }
        onDragStart={(event) => {
          event.dataTransfer.setData("text/plain", String(task.id));
          setDragged(task.id);
        }}
        onDragEnd={() => setDragged(undefined)}
        className="min-w-0 cursor-grab rounded-xl border border-neutral-200/80 bg-white p-4 shadow-sm transition-shadow duration-200 hover:shadow-md active:cursor-grabbing"
      >
        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
          <span
            className={
              task.priority === "HIGH"
                ? "rounded-full bg-amber-100 px-2 py-1 text-amber-900"
                : "rounded-full bg-brand-cream px-2 py-1"
            }
          >
            Prioridad {priority[task.priority]}
          </span>
          {task.crew && <span className="rounded-md bg-teal-50 px-2 py-1 text-[10px] text-teal-700">Cuadrilla</span>}
          <GripVertical size={15} className="ml-auto text-neutral-300" aria-hidden="true"/>
        </div>
        <h3 className="mt-3 break-words font-sans text-sm font-semibold">
          {task.title}
        </h3>
        <p className="mt-1 break-words text-sm text-brand-muted">
          {task.project_name} · {task.location}
        </p>
        <div className="mt-4 flex items-center gap-2 border-t border-neutral-100 pt-3"><div className="flex shrink-0 -space-x-1.5">{task.assignees.slice(0, 3).map(person => <span key={person.id} title={person.name} className="grid size-7 place-items-center rounded-full border-2 border-white bg-emerald-100 text-[10px] font-semibold text-emerald-800">{person.name.split(" ").map(part => part[0]).slice(0, 2).join("")}</span>)}</div><p className="min-w-0 text-xs text-neutral-500">{task.assignees.map(person => person.name).join(", ")}</p></div>
        <p className="mt-1 text-xs text-brand-muted">
          Fecha: {task.scheduled_date} · {task.activity}
        </p>
        <p className="mt-3 text-sm">
          {task.target_quantity !== null
            ? `Meta: ${task.target_quantity} ${task.unit} · Realizado: ${task.work_logs.at(-1)?.quantity ?? "pendiente"} · Aceptado: ${task.accepted_quantity ?? "pendiente"}`
            : "Evaluación por cumplimiento"}
        </p>
        {task.blocked_reason && (
          <p className="mt-3 break-words rounded-lg bg-amber-50 p-2 text-sm text-amber-900">
            Bloqueada: {task.blocked_reason}
          </p>
        )}
        {task.cancelled_at && (
          <p className="mt-3 break-words rounded-lg bg-red-50 p-2 text-sm text-red-800">
            Cancelada: {task.cancelled_reason}
          </p>
        )}
        {task.warnings.length > 0 && (
          <details className="mt-3 text-xs text-amber-900">
            <summary className="cursor-pointer py-2">
              {task.warnings.length} aviso(s) de disponibilidad
            </summary>
            <ul className="list-disc space-y-2 pl-4">
              {task.warnings.map((warning, i) => (
                <li key={i}>{warning}</li>
              ))}
            </ul>
          </details>
        )}
        {mode === "close" && (
          <div className="mt-3 space-y-2 rounded-xl bg-brand-paper p-3 text-sm">
            <p>
              Tiempo del equipo
              {mode === "close" && date
                ? " en la fecha seleccionada"
                : " registrado"}
              :{" "}
              {mode === "close" && date
                ? (
                    task.work_logs
                      .filter((log) => log.work_date === date)
                      .flatMap((log) => log.times)
                      .reduce((sum, item) => sum + item.minutes, 0) / 60
                  ).toFixed(2)
                : task.hours}{" "}
              h
            </p>
            <p className="break-words">
              Último resultado: {dailyLog?.result ?? "pendiente"}
            </p>
            <p className="break-words">
              Incidencias: {dailyLog?.incidents || "ninguna registrada"}
            </p>
          </div>
        )}
        {mode === "history" && (
          <div className="mt-3 space-y-1 text-sm">
            <p>Tiempo registrado del equipo: {task.hours} h</p>
            <p>
              {task.crew
                ? "Cantidad compartida; sin atribución ni productividad individual."
                : task.productivity !== null
                  ? `${task.productivity} ${task.unit}/h aceptadas`
                  : "Productividad: pendiente o no aplicable"}
            </p>
            <p>
              Comparar solo la misma actividad, unidad, proyecto y condiciones.
            </p>
          </div>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            disabled={busy || loading}
            className={button}
            onClick={() => setDialog({ action: "detail", task })}
          >
            Ver historial
          </button>
          {manager && (
            <button
              disabled={busy || loading}
              className={button}
              onClick={() => setDialog({ action: "duplicate", task })}
            >
              Duplicar
            </button>
          )}
          {!task.cancelled_at && task.state !== "DONE" && (
            <>
              {!task.blocked_reason && task.state === "TODO" && (
                <button
                  disabled={busy || loading}
                  className={button}
                  onClick={() => void run(task, "start")}
                >
                  Iniciar
                </button>
              )}
              {!task.blocked_reason && task.state === "IN_PROGRESS" && (
                <button
                  disabled={busy || loading}
                  className={button}
                  onClick={() => setDialog({ action: "submit", task })}
                >
                  Registrar resultado
                </button>
              )}
              {!task.blocked_reason && task.state === "REVIEW" && (
                <button
                  disabled={busy || loading}
                  className={button}
                  onClick={() => setDialog({ action: "time", task })}
                >
                  Registrar tiempo faltante
                </button>
              )}
              {!task.blocked_reason && manager && task.state === "REVIEW" && (
                <>
                  <button
                    disabled={busy || loading}
                    className={button}
                    onClick={() => setDialog({ action: "accept", task })}
                  >
                    Aceptar
                  </button>
                  <button
                    disabled={busy || loading}
                    className={button}
                    onClick={() => setDialog({ action: "return", task })}
                  >
                    Devolver
                  </button>
                </>
              )}
              {!task.work_logs.length && manager && (
                <button
                  disabled={busy || loading}
                  className={button}
                  onClick={() => setDialog({ action: "edit", task })}
                >
                  Editar
                </button>
              )}
              {task.blocked_reason ? (
                <button
                  disabled={busy || loading}
                  className={button}
                  onClick={() => void run(task, "unblock")}
                >
                  Quitar bloqueo
                </button>
              ) : (
                <button
                  disabled={busy || loading}
                  className={button}
                  onClick={() => setDialog({ action: "block", task })}
                >
                  Bloquear
                </button>
              )}
              {manager && (
                <button
                  disabled={busy || loading}
                  className={button}
                  onClick={() => setDialog({ action: "cancel", task })}
                >
                  Cancelar tarea
                </button>
              )}
            </>
          )}
        </div>
      </article>
    );
  }

  return (
    <section className="mx-auto max-w-[100rem] px-4 py-7 text-brand-ink sm:px-7 lg:px-9">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-secondary">
            Personal · trabajo y revisión
          </p>
          <h1 className="mt-3 font-sans text-4xl font-semibold">
            {mode === "board"
              ? "Trabajo de hoy"
              : mode === "close"
                ? "Cierre de jornada"
                : "Historial por trabajador"}
          </h1>
          <p className="mt-3 max-w-2xl text-brand-muted">
            Resultados verificables, sin modificar asistencias, tarifas ni
            planillas.
          </p>
        </div>
        {manager && mode === "board" && (
          <button
            className={primaryButton}
            onClick={() => setDialog({ action: "create" })}
          >
            Nueva tarea
          </button>
        )}
      </header>
      <nav aria-label="Vistas de trabajo" className="my-6 flex flex-wrap gap-2">
        {[
          ["board", "", "Trabajo de hoy"],
          ["close", "/close", "Cierre de jornada"],
          ["history", "/history", "Historial por trabajador"],
        ].map(([id, path, label]) => (
          <Link
            key={id}
            className={button}
            aria-current={mode === id ? "page" : undefined}
            href={`/dashboard/workforce${path}`}
          >
            {label}
          </Link>
        ))}
      </nav>
      <div className="mb-6 grid gap-3 rounded-2xl border border-brand-border bg-white p-4 sm:grid-cols-3">
        <label className="text-sm font-semibold">
          Fecha
          <input
            className={input}
            type="date"
            value={date}
            onChange={(e) => filter(setDate, e.target.value)}
          />
        </label>
        <label className="text-sm font-semibold">
          Persona
          <select
            aria-label="Persona"
            className={input}
            value={employee}
            onChange={(e) => filter(setEmployee, e.target.value)}
          >
            <option value="">
              {manager ? "Todas las personas" : "Mis tareas"}
            </option>
            {options?.employees.map((person) => (
              <option key={person.id} value={person.id}>
                {person.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-semibold">
          Proyecto o sector
          <select
            aria-label="Proyecto o sector"
            className={input}
            value={project}
            onChange={(e) => filter(setProject, e.target.value)}
          >
            <option value="">Todos mis proyectos</option>
            {options?.projects.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      {notice && (
        <p role="status" className="mb-4 rounded-xl bg-brand-sage/30 p-4">
          {notice}
        </p>
      )}
      {error && !dialog && (
        <div
          role="alert"
          className="mb-4 rounded-xl bg-red-50 p-4 text-red-800"
        >
          <p>{error}</p>
          <button
            className={button + " mt-3"}
            onClick={() => {
              setLoading(true);
              refresh();
            }}
          >
            Recargar estado y reintentar
          </button>
        </div>
      )}
      {loading && (
        <p role="status" className="my-5">
          Cargando tareas…
        </p>
      )}
      {!loading && !error && !tasks.length && (
        <p className="rounded-2xl border border-dashed border-brand-border bg-white p-8">
          No hay tareas para estos filtros.{" "}
          {manager
            ? "Crea la primera asignación cuando corresponda."
            : "Solicita al administrador que compruebe tu vínculo y asignación al proyecto."}
        </p>
      )}
      {mode === "board" ? (
        <>
          <div
            className="mb-4 flex flex-wrap gap-2 lg:hidden"
            aria-label="Elegir columna"
          >
            {states.map(([id, label]) => (
              <button
                key={id}
                className={button}
                aria-pressed={mobileState === id}
                onClick={() => setMobileState(id)}
              >
                {label} ({tasks.filter((task) => task.state === id).length})
              </button>
            ))}
          </div>
          <div className="grid min-w-0 gap-4 lg:grid-cols-2 xl:grid-cols-4">
            {states.map(([id, label]) => (
              <section
                key={id}
                aria-label={label}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  drop(id);
                }}
                className={`${mobileState === id ? "block" : "hidden"} min-h-64 min-w-0 rounded-xl border border-neutral-200/70 bg-neutral-100/80 p-3 lg:block`}
              >
                <h2 className="mb-4 flex items-center justify-between px-1 font-sans text-xs font-semibold uppercase tracking-wide text-neutral-600">
                  {label}{" "}
                  <span className="rounded-md bg-white px-2 py-0.5 text-xs text-neutral-500">
                    {tasks.filter((task) => task.state === id).length}
                  </span>
                </h2>
                <div className="space-y-3">
                  {tasks.filter((task) => task.state === id).map(card)}
                </div>
              </section>
            ))}
          </div>
        </>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {tasks.map(card)}
        </div>
      )}
      {!!data?.count && (
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            className={button}
            disabled={!data.previous || loading}
            onClick={() => {
              setPage((v) => v - 1);
              setLoading(true);
            }}
          >
            Anterior
          </button>
          <span>
            Página {page} · {data.count} tareas
          </span>
          <button
            className={button}
            disabled={!data.next || loading}
            onClick={() => {
              setPage((v) => v + 1);
              setLoading(true);
            }}
          >
            Siguiente
          </button>
        </div>
      )}
      {manager && options && (
        <details className="mt-8 rounded-2xl border border-brand-border bg-white p-4">
          <summary className="cursor-pointer py-2 font-semibold">
            Vincular empleado con su cuenta
          </summary>
          <p className="my-3 text-sm text-brand-muted">
            No se infieren identidades. La cuenta debe pertenecer previamente a
            los proyectos del empleado. El vínculo es permanente para preservar
            atribución.
          </p>
          <form
            className="grid gap-3 sm:grid-cols-3"
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              void mutate("link_account/", {
                employee: Number(form.get("employee")),
                user: form.get("user"),
              });
            }}
          >
            <label>
              Empleado
              <select required name="employee" className={input}>
                {options.employees
                  .filter((item) => item.active)
                  .map((person) => (
                    <option key={person.id} value={person.id}>
                      {person.name}
                      {options.links?.some(
                        (link) => link.employee_id === person.id,
                      )
                        ? " · vinculado"
                        : ""}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Cuenta
              <select required name="user" className={input}>
                {options.accounts?.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name}
                  </option>
                ))}
              </select>
            </label>
            <button
              disabled={busy || !options.accounts?.length}
              className={button}
            >
              Guardar vínculo
            </button>
          </form>
        </details>
      )}
      {dialog && options && (
        <TaskDialog
          action={dialog.action}
          task={dialog.task}
          options={options}
          busy={busy}
          error={error}
          close={() => {
            if (!busy) {
              setDialog(undefined);
              setError("");
            }
          }}
          save={mutate}
        />
      )}
    </section>
  );
}

function TaskDialog({
  action,
  task,
  options,
  busy,
  error,
  close,
  save,
}: {
  action: Action;
  task?: Task;
  options: Options;
  busy: boolean;
  error: string;
  close: () => void;
  save: (
    route: string,
    body: Record<string, unknown>,
    method?: string,
  ) => Promise<void>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);
  const titles: Record<Action, string> = {
    create: "Nueva tarea",
    edit: "Editar planificación",
    submit: "Registrar resultado",
    time: "Registrar tiempo faltante",
    accept: "Aceptar trabajo",
    return: "Devolver para corrección",
    block: "Bloquear tarea",
    cancel: "Cancelar tarea",
    duplicate: "Duplicar planificación",
    detail: "Historial y resultado",
  };
  const planning = action === "create" || action === "edit";
  const existingTime = task?.work_logs.at(-1)?.times ?? [];
  const people =
    (options.administrator
      ? task?.assignees
      : task?.assignees.filter((person) =>
          options.employees.some((item) => item.id === person.id),
        )
    )?.filter(
      (person) =>
        action !== "time" ||
        !existingTime.some((item) => item.employee === person.id),
    ) ?? [];
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const body: Record<string, unknown> = {};
    for (const [key, value] of form.entries())
      if (!key.startsWith("minutes_") && key !== "assignees") body[key] = value;
    if (planning) {
      body.project = Number(form.get("project"));
      body.assignees = form.getAll("assignees").map(Number);
      body.target_quantity = form.get("target_quantity") || null;
      body.estimated_minutes = form.get("estimated_minutes")
        ? Number(form.get("estimated_minutes"))
        : null;
    } else {
      body.action = action;
      body.revision = task?.revision;
    }
    if (action === "submit" || action === "time")
      body.times = people.map((person) => ({
        employee: person.id,
        minutes: Number(form.get(`minutes_${person.id}`)),
      }));
    if (action === "submit") {
      body.criterion_met = form.get("criterion_met") === "on";
      body.quantity = form.get("quantity") || null;
    }
    if (action === "accept")
      body.accepted_quantity = form.get("accepted_quantity") || null;
    if (action === "edit") body.revision = task?.revision;
    void save(
      action === "create"
        ? ""
        : action === "edit"
          ? `${task?.id}/`
          : `${task?.id}/command/`,
      body,
      action === "edit" ? "PATCH" : "POST",
    );
  }
  return (
    <dialog
      ref={dialog}
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
      aria-labelledby="workforce-dialog-title"
      className="m-auto max-h-[92svh] w-[calc(100%-1.5rem)] max-w-2xl overflow-y-auto rounded-2xl border border-brand-border bg-brand-paper p-5 text-brand-ink shadow-xl backdrop:bg-black/45 sm:p-8"
    >
      <div className="mb-5 flex items-start justify-between gap-3">
        <h2
          id="workforce-dialog-title"
          className="font-sans text-2xl font-semibold"
        >
          {titles[action]}
        </h2>
        <button
          disabled={busy}
          className={button}
          onClick={close}
          aria-label="Cerrar diálogo"
        >
          Cerrar
        </button>
      </div>
      {error && (
        <div
          role="alert"
          className="mb-4 rounded-xl bg-red-50 p-3 text-red-800"
        >
          <p>{error}</p>
          <p className="mt-2 text-sm">
            Puedes reintentar. Si la revisión cambió, cierra y recarga el
            tablero.
          </p>
        </div>
      )}
      {action === "detail" && task ? (
        <div className="space-y-5">
          <h3 className="break-words font-sans text-xl">{task.title}</h3>
          <p className="whitespace-pre-wrap break-words">
            {task.instructions || "Sin instrucciones adicionales."}
          </p>
          <p className="whitespace-pre-wrap break-words">
            <strong>Criterio:</strong> {task.acceptance_criteria}
          </p>
          {task.work_logs.length === 0 && (
            <p>Aún no hay resultados registrados.</p>
          )}
          {task.work_logs.map((record) => (
            <article
              key={record.id}
              className="space-y-2 rounded-xl border border-brand-border bg-white p-4"
            >
              <p className="break-words whitespace-pre-wrap">{record.result}</p>
              <p>
                Fecha real: {record.work_date ?? "no registrada"} · Criterio: {record.criterion_met ? "cumplido" : "pendiente"} ·
                Cantidad: {record.quantity ?? "no aplicable"}
              </p>
              <p>Incidencias: {record.incidents || "ninguna registrada"}</p>
              {record.times.map((time) => (
                <p key={time.employee}>
                  {
                    task.assignees.find((person) => person.id === time.employee)
                      ?.name
                  }
                  : {time.minutes} min
                </p>
              ))}
              <p>
                {record.review
                  ? `${record.review.accepted ? "Aceptado" : "Devuelto"}: ${record.review.observations} · ${new Date(record.review.created_at).toLocaleString("es-NI")} · revisor ${record.review.reviewed_by_name ?? record.review.reviewed_by}`
                  : "Revisión pendiente"}
              </p>
            </article>
          ))}
          <details>
            <summary className="cursor-pointer py-3 font-semibold">
              Registro de cambios ({task.events.length})
            </summary>
            <ol className="space-y-3 text-sm">
              {task.events.map((item, i) => (
                <li key={i} className="break-words">
                  {item.action} ·{" "}
                  {new Date(item.created_at).toLocaleString("es-NI")} · usuario{" "}
                  {item.actor_name ?? item.actor}
                  {item.detail.reason ? ` · ${String(item.detail.reason)}` : ""}
                </li>
              ))}
            </ol>
          </details>
        </div>
      ) : (
        <form onSubmit={submit}>
          <fieldset disabled={busy} className="space-y-4">
            {planning && (
              <>
                <label className="block">
                  Título
                  <input
                    required
                    name="title"
                    maxLength={160}
                    className={input}
                    defaultValue={task?.title}
                  />
                </label>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label>
                    Actividad
                    <input
                      required
                      name="activity"
                      maxLength={100}
                      className={input}
                      defaultValue={task?.activity}
                    />
                  </label>
                  <label>
                    Ubicación o sector
                    <input
                      required
                      name="location"
                      maxLength={160}
                      className={input}
                      defaultValue={task?.location}
                    />
                  </label>
                  <label>
                    Proyecto
                    <select
                      name="project"
                      required
                      className={input}
                      defaultValue={task?.project}
                    >
                      {options.projects
                        .filter((project) => project.status === "active")
                        .map((project) => (
                          <option key={project.id} value={project.id}>
                            {project.name}
                          </option>
                        ))}
                    </select>
                  </label>
                  <label>
                    Fecha prevista
                    <input
                      name="scheduled_date"
                      required
                      type="date"
                      className={input}
                      defaultValue={task?.scheduled_date ?? today()}
                    />
                  </label>
                  <label>
                    Prioridad
                    <select
                      name="priority"
                      className={input}
                      defaultValue={task?.priority ?? "NORMAL"}
                    >
                      {Object.entries(priority).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <fieldset className="rounded-xl border border-brand-border p-3">
                  <legend>Responsables individuales o cuadrilla</legend>
                  <div className="grid gap-1 sm:grid-cols-2">
                    {options.employees
                      .filter((person) => person.active)
                      .map((person) => (
                        <label
                          key={person.id}
                          className="flex min-h-11 items-center gap-3"
                        >
                          <input
                            type="checkbox"
                            name="assignees"
                            value={person.id}
                            defaultChecked={task?.assignees.some(
                              (item) => item.id === person.id,
                            )}
                            className="size-5"
                          />
                          {person.name}
                        </label>
                      ))}
                  </div>
                  <p className="text-xs text-brand-muted">
                    Selecciona al menos una persona. Varias personas comparten
                    la cantidad del resultado.
                  </p>
                </fieldset>
                <label className="block">
                  Criterio de aceptación
                  <textarea
                    required
                    name="acceptance_criteria"
                    maxLength={5000}
                    className={input}
                    defaultValue={task?.acceptance_criteria}
                  />
                </label>
                <details open={action === "edit"}>
                  <summary className="cursor-pointer py-3 font-semibold">
                    Instrucciones, meta y tiempo opcionales
                  </summary>
                  <label className="block">
                    Instrucciones
                    <textarea
                      name="instructions"
                      maxLength={5000}
                      className={input}
                      defaultValue={task?.instructions}
                    />
                  </label>
                  <div className="mt-4 grid gap-4 sm:grid-cols-3">
                    <label>
                      Cantidad objetivo
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        name="target_quantity"
                        className={input}
                        defaultValue={task?.target_quantity ?? ""}
                      />
                    </label>
                    <label>
                      Unidad
                      <input
                        maxLength={40}
                        name="unit"
                        className={input}
                        defaultValue={task?.unit}
                        placeholder="metros, kg…"
                      />
                    </label>
                    <label>
                      Minutos previstos por persona
                      <input
                        type="number"
                        min="1"
                        max="10080"
                        name="estimated_minutes"
                        className={input}
                        defaultValue={task?.estimated_minutes ?? ""}
                      />
                    </label>
                  </div>
                  <p className="mt-3 text-xs">
                    Sin meta numérica: se evalúa el cumplimiento del criterio.
                  </p>
                </details>
              </>
            )}
            {action === "duplicate" && (
              <>
                <p>
                  Se copiará solo la planificación. No se copian resultados,
                  tiempos, bloqueos, revisiones ni aprobaciones.
                </p>
                <label className="block">
                  Nueva fecha
                  <input
                    required
                    type="date"
                    name="scheduled_date"
                    className={input}
                    defaultValue={today()}
                  />
                </label>
              </>
            )}
            {action === "submit" && (
              <>
                <p className="rounded-xl bg-brand-sage/30 p-3 text-sm">
                  Criterio: {task?.acceptance_criteria}
                </p>
                <label className="block">
                  Fecha real de trabajo
                  <input
                    required
                    type="date"
                    name="work_date"
                    className={input}
                    defaultValue={today()}
                    max={today()}
                  />
                </label>
                <label className="block">
                  Resultado realizado
                  <textarea
                    required
                    name="result"
                    maxLength={5000}
                    className={input}
                  />
                </label>
                {task?.target_quantity !== null && (
                  <label className="block">
                    Cantidad realizada acumulada ({task?.unit})
                    <input
                      required
                      type="number"
                      min="0"
                      step="0.01"
                      name="quantity"
                      className={input}
                    />
                  </label>
                )}
                <label className="flex min-h-11 items-center gap-3">
                  <input
                    type="checkbox"
                    name="criterion_met"
                    className="size-5"
                  />
                  Se cumplió el criterio de aceptación
                </label>
                <label className="block">
                  Incidencias
                  <textarea
                    name="incidents"
                    maxLength={5000}
                    className={input}
                  />
                </label>
              </>
            )}
            {(action === "submit" || action === "time") && (
              <fieldset>
                <legend className="font-semibold">
                  Tiempo real dedicado, en minutos
                </legend>
                <p className="my-2 text-sm">
                  Registra solo minutos adicionales de esta entrega, sin repetir
                  los de entregas anteriores. No genera pagos.
                </p>
                {people.map((person) => (
                  <label key={person.id} className="mb-3 block">
                    {person.name}
                    <input
                      required
                      type="number"
                      min="1"
                      max="1440"
                      name={`minutes_${person.id}`}
                      className={input}
                    />
                  </label>
                ))}
                {!people.length && (
                  <p>
                    Ya están registrados todos los tiempos que puedes informar.
                  </p>
                )}
              </fieldset>
            )}
            {(action === "accept" || action === "return") && (
              <>
                <p className="rounded-xl bg-white p-3">
                  Resultado: {task?.work_logs.at(-1)?.result}
                </p>
                <label className="block">
                  Observaciones de revisión
                  <textarea
                    required
                    name="observations"
                    maxLength={5000}
                    className={input}
                  />
                </label>
                {action === "accept" && task?.target_quantity !== null && (
                  <label className="block">
                    Cantidad aceptada ({task?.unit})
                    <input
                      required
                      type="number"
                      min="0"
                      max={task?.work_logs.at(-1)?.quantity ?? undefined}
                      step="0.01"
                      name="accepted_quantity"
                      className={input}
                    />
                  </label>
                )}
                <p className="text-sm">
                  Se conservarán el revisor, la fecha y cada devolución
                  anterior.
                </p>
              </>
            )}
            {(action === "block" || action === "cancel") && (
              <label className="block">
                Motivo
                <textarea
                  required
                  name="reason"
                  maxLength={2000}
                  className={input}
                />
              </label>
            )}
            <button
              disabled={
                busy ||
                ((action === "submit" || action === "time") && !people.length)
              }
              type="submit"
              className={primaryButton + " w-full"}
            >
              {busy
                ? "Guardando…"
                : planning
                  ? "Guardar tarea"
                  : action === "submit"
                    ? "Enviar a revisión"
                    : "Confirmar"}
            </button>
          </fieldset>
        </form>
      )}
    </dialog>
  );
}
