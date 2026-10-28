"use client";
import { FarmLoader } from "@/components/farm-loader";
import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type FormEvent,
} from "react";
import {
  Plus,
  X,
  Play,
  CheckCheck,
  Send,
  Copy,
  Flag,
  RefreshCw,
  Clock3,
  History,
  MapPin,
  AlertTriangle,
  Ban,
  Pencil,
  Paperclip,
  Users,
  ListTodo,
} from "lucide-react";
import type { AuthUser } from "@/types/auth";
import type { CloudRow } from "@/lib/firebase-client";
import { fullName, text } from "@/lib/firebase-models";
import {
  columns,
  priorities,
  canPlan,
  duplicatePlan,
  productivity,
  type Status,
  type Plan,
  type WorkTask,
  type Command,
} from "@/lib/firebase-workforce-domain";
import {
  readWorkforce,
  createWorkTask,
  commandWorkTask,
  uploadEvidence,
  evidenceUrl,
  adjustWorker,
  workforceUsers,
  bindWorkforceAccount,
  type WorkerPatch,
} from "@/lib/firebase-workforce";

export const fincaDate = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Managua",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
function dateLabel(value: unknown) {
  return value && typeof value === "object" && "toDate" in value
    ? (value as { toDate(): Date })
        .toDate()
        .toLocaleString("es-NI", { timeZone: "America/Managua" })
    : "";
}
export function Modal({
  title,
  children,
  close,
}: {
  title: string;
  children: ReactNode;
  close(): void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      onCancel={close}
      aria-label={title}
      className="work-dialog"
    >
      <header className="flex items-center justify-between gap-4 border-b border-neutral-200 p-5">
        <h2 className="text-lg font-semibold">{title}</h2>
        <button
          aria-label="Cerrar ventana"
          onClick={close}
          className="f-button"
        >
          <X size={18} />
        </button>
      </header>
      <div className="p-5">{children}</div>
    </dialog>
  );
}
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid min-w-0 gap-1.5 text-xs font-medium text-neutral-600">
      {label}
      {children}
    </label>
  );
}
function initialPlan(): Plan {
  return {
    title: "",
    activity: "",
    project: "",
    location: "",
    assignees: [],
    assigneeNames: {},
    dueDate: fincaDate(),
    priority: "normal",
    instructions: "",
    acceptanceCriteria: "",
    targetQuantity: null,
    unit: "",
    estimatedHours: null,
  };
}
type Loaded = Awaited<ReturnType<typeof readWorkforce>>;
export function FirebaseWorkforceBoard({
  user,
  workers,
  units,
  attendance,
  create = false,
  historyWorker = "",
}: {
  user: AuthUser;
  workers: CloudRow[];
  units: CloudRow[];
  attendance: CloudRow[];
  create?: boolean;
  historyWorker?: string;
}) {
  const [data, setData] = useState<Loaded>(),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<Status>("todo"),
    [filter, setFilter] = useState(historyWorker),
    [day, setDay] = useState("");
  const [selected, setSelected] = useState<string>(),
    [editor, setEditor] = useState<{ plan: Plan; task?: WorkTask } | null>(
      create && canPlan(user.role) ? { plan: initialPlan() } : null,
    );
  const [closing, setClosing] = useState<WorkTask>(),
    [reviewing, setReviewing] = useState<WorkTask>();
  const [closeMode, setCloseMode] = useState<"submit" | "progress">("submit");
  const [reasonAction, setReasonAction] = useState<{
    task: WorkTask;
    action: "block" | "unblock" | "cancel";
  }>();
  const [query, setQuery] = useState("");
  const locked = useRef(false),
    operations = useRef(new Map<string, string>());
  const manager = canPlan(user.role);
  const refresh = async () => {
    const result = await readWorkforce(user);
    setData(result);
    return result;
  };
  useEffect(() => {
    let active = true;
    void readWorkforce(user)
      .then((value) => {
        if (active) setData(value);
      })
      .catch(() => {
        if (active)
          setError(
            "No se pudo consultar el tablero. Comprueba la conexión y vuelve a intentar.",
          );
      });
    return () => {
      active = false;
    };
  }, [user]);
  async function execute(
    key: string,
    job: (id: string) => Promise<void>,
    success?: () => void,
  ) {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setError("");
    const id = operations.current.get(key) ?? crypto.randomUUID();
    operations.current.set(key, id);
    try {
      await job(id);
      await refresh();
      operations.current.delete(key);
      success?.();
    } catch (e) {
      setError(
        e instanceof Error && !e.message.includes("Firebase")
          ? e.message
          : "No se confirmó el cambio. Comprueba la conexión y vuelve a intentar; no se moverá la tarjeta sin confirmación del servidor.",
      );
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  const command = (task: WorkTask, value: Command, close?: () => void) =>
    execute(
      JSON.stringify({ task: task.id, revision: task.revision, value }),
      (id) => commandWorkTask(user, task, value, id, data?.workerId ?? null),
      close,
    );
  const person = (id: string) => {
    const row = workers.find((w) => w.id === id);
    return row
      ? fullName(row)
      : (data?.tasks.find((t) => t.assignees.includes(id))?.assigneeNames[id] ??
          "Persona asignada");
  };
  const tasks = (data?.tasks ?? [])
    .filter(
      (t) =>
        (!filter || t.assignees.includes(filter)) &&
        (!day || t.dueDate === day) &&
        `${t.title} ${t.activity} ${t.location}`
          .toLocaleLowerCase()
          .includes(query.toLocaleLowerCase()),
    )
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const current = data?.tasks.find((t) => t.id === selected);
  const allPeople = [
    ...new Set([
      ...workers.map((w) => w.id),
      ...(data?.tasks.flatMap((t) => t.assignees) ?? []),
    ]),
  ];
  function warnings(plan: Plan) {
    return plan.assignees.flatMap((id) => {
      const worker = workers.find((w) => w.id === id),
        absent = attendance.some(
          (a) =>
            a.workerId === id &&
            a.date === plan.dueDate &&
            a.status === "absent",
        );
      const hours = (data?.tasks ?? [])
        .filter(
          (t) =>
            t.id !== editor?.task?.id &&
            t.assignees.includes(id) &&
            t.dueDate === plan.dueDate &&
            !t.isCancelled &&
            t.status !== "done",
        )
        .reduce(
          (sum, t) => sum + (t.estimatedHours ?? 0),
          plan.estimatedHours ?? 0,
        );
      return [
        ...(worker?.status !== "active"
          ? [`${person(id)} está inactivo: no se permite asignarlo.`]
          : []),
        ...(absent ? [`${person(id)} figura ausente en esta fecha.`] : []),
        ...(hours > 8
          ? [
              `${person(id)} acumularía ${hours.toFixed(1)} h previstas; supera 8 h.`,
            ]
          : []),
      ];
    });
  }
  const taskLog = (t: WorkTask) =>
    data?.logs.find((l) => l.id === t.latestLogId);
  const taskReview = (t: WorkTask) =>
    data?.reviews.find((r) => r.id === t.latestReviewId);
  function move(task: WorkTask, status: Status) {
    if (busy || task.status === status) return;
    if (status === "in_progress" && task.status === "todo")
      void command(task, { action: "start" });
    else if (status === "review" && task.status === "in_progress")
      { setCloseMode("submit"); setClosing(task); }
    else if (
      status === "done" &&
      task.status === "review" &&
      user.role === "ADMIN"
    )
      setReviewing(task);
    else
      setError(
        "Usa el flujo Por hacer → En curso → Cierre → Revisión del Administrador. Para corregir un cierre, devuelve la tarea.",
      );
  }
  function actions(task: WorkTask) {
    return (
      <div className="mt-4 flex flex-wrap gap-2">
        {!task.isBlocked && !task.isCancelled && task.status === "todo" && (
          <button
            disabled={busy}
            className="f-button f-primary"
            onClick={() => void command(task, { action: "start" })}
          >
            <Play size={14} />
            Iniciar
          </button>
        )}
        {!task.isBlocked &&
          !task.isCancelled &&
          task.status === "in_progress" &&
          (manager || task.assignees.length === 1) && (
            <button
              disabled={busy}
              className="f-button f-primary"
              onClick={() => { setCloseMode("submit"); setClosing(task); }}
            >
              <Send size={14} />
              Registrar cierre
            </button>
          )}
        {!task.isBlocked && !task.isCancelled && task.status === "in_progress" && (manager || task.assignees.length === 1) && (
          <button disabled={busy} className="f-button" onClick={() => { setCloseMode("progress"); setClosing(task); }}>
            Registrar avance del día
          </button>
        )}
        {!task.isBlocked &&
          !task.isCancelled &&
          task.status === "review" &&
          user.role === "ADMIN" && (
            <button
              disabled={busy}
              className="f-button f-primary"
              onClick={() => setReviewing(task)}
            >
              <CheckCheck size={14} />
              Revisar cierre
            </button>
          )}
        {!task.isCancelled && task.status !== "done" && (
          <button
            disabled={busy}
            className="f-button"
            onClick={() =>
              setReasonAction({
                task,
                action: task.isBlocked ? "unblock" : "block",
              })
            }
          >
            <Flag size={14} />
            {task.isBlocked ? "Resolver bloqueo" : "Bloquear"}
          </button>
        )}
        {manager && (
          <button
            disabled={busy}
            className="f-button"
            onClick={() =>
              setEditor({ plan: duplicatePlan(task, fincaDate()) })
            }
          >
            <Copy size={14} />
            Duplicar plan
          </button>
        )}
        {manager &&
          !task.isCancelled &&
          task.logCount === 0 &&
          ["todo", "in_progress"].includes(task.status) && (
            <button
              disabled={busy}
              className="f-button"
              onClick={() =>
                setEditor({ task, plan: duplicatePlan(task, task.dueDate) })
              }
            >
              <Pencil size={14} />
              Editar plan
            </button>
          )}
        {user.role === "ADMIN" &&
          !task.isCancelled &&
          task.status !== "done" && (
            <button
              disabled={busy}
              className="f-button text-red-700"
              onClick={() => setReasonAction({ task, action: "cancel" })}
            >
              <Ban size={14} />
              Cancelar
            </button>
          )}
      </div>
    );
  }
  return (
    <div className="mt-6 min-w-0 space-y-5">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {(Object.entries(columns) as [Status, string][]).map(
          ([status, label]) => (
            <div key={status} className="kpi-card !p-4">
              <span className="text-xs text-neutral-500">{label}</span>
              <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight">
                {
                  tasks.filter((t) => t.status === status && !t.isCancelled)
                    .length
                }
              </p>
            </div>
          ),
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input
          className="f-input flex-1"
          aria-label="Buscar tareas"
          placeholder="Buscar labor o ubicación…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select
          className="f-input"
          aria-label="Filtrar trabajador"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="">Todo el equipo</option>
          {allPeople.map((id) => (
            <option key={id} value={id}>
              {person(id)}
            </option>
          ))}
        </select>
        <input
          className="f-input"
          type="date"
          aria-label="Filtrar fecha"
          value={day}
          onChange={(e) => setDay(e.target.value)}
        />
        <button
          className="f-button"
          disabled={busy}
          onClick={() => void execute("refresh", async () => {})}
        >
          <RefreshCw size={16} />
          <span className="sr-only">Actualizar tablero</span>
        </button>
        {manager && (
          <button
            className="f-button f-primary"
            onClick={() => setEditor({ plan: initialPlan() })}
          >
            <Plus size={16} />
            Crear tarea
          </button>
        )}
      </div>
      {error && (
        <p
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
        >
          {error}
        </p>
      )}
      {!data && !error && (
        <FarmLoader message="Cargando el trabajo registrado…" />
      )}
      {data && user.role === "WORKER" && !data.workerId && (
        <p role="status" className="surface-card p-5 text-sm">
          Tu cuenta todavía no está vinculada a una ficha de trabajador. El
          Administrador puede vincular el perfil existente desde Usuarios.
        </p>
      )}
      <nav
        className="grid grid-cols-4 gap-1 md:hidden"
        aria-label="Columnas del tablero"
      >
        {(Object.entries(columns) as [Status, string][]).map(
          ([status, label]) => (
            <button
              key={status}
              className={`min-h-12 rounded-lg px-1 text-[11px] font-semibold ${tab === status ? "bg-emerald-700 text-white" : "bg-neutral-100 text-neutral-600"}`}
              aria-pressed={tab === status}
              onClick={() => setTab(status)}
            >
              {label}
              <span className="block">
                {tasks.filter((t) => t.status === status).length}
              </span>
            </button>
          ),
        )}
      </nav>
      <div className="grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {(Object.entries(columns) as [Status, string][]).map(
          ([status, label]) => (
            <section
              key={status}
              aria-label={label}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const task = data?.tasks.find(
                  (t) => t.id === e.dataTransfer.getData("text/plain"),
                );
                if (task) move(task, status);
              }}
              className={`${tab !== status ? "hidden md:block" : ""} min-w-0 rounded-2xl border border-neutral-200/70 bg-neutral-100/80 p-3`}
            >
              <h2 className="mb-4 flex items-center gap-2 px-1 text-sm font-semibold">
                <span
                  className={`size-2 rounded-full ${status === "done" ? "bg-emerald-500" : status === "review" ? "bg-amber-500" : status === "in_progress" ? "bg-sky-500" : "bg-neutral-400"}`}
                />
                {label}
                <span className="ml-auto rounded-md bg-white px-2 py-0.5 text-xs text-neutral-500">
                  {tasks.filter((t) => t.status === status).length}
                </span>
              </h2>
              <div className="space-y-3">
                {tasks
                  .filter((t) => t.status === status)
                  .map((task) => {
                    const log = taskLog(task);
                    const accepted = taskReview(task);
                    const progressIds = new Set(data?.events.filter((event) => event.taskId === task.id && event.action === "progress").map((event) => event.id));
                    const progressLogs = data?.logs.filter((entry) => progressIds.has(entry.id)) ?? [];
                    const progressHours = progressLogs.reduce((sum, entry) => sum + Object.values(entry.minutes).reduce((minutes, value) => minutes + value, 0), 0) / 60;
                    const progressQuantity = progressLogs.reduce((sum, entry) => sum + (entry.quantity ?? 0), 0);
                    return (
                      <article
                        key={task.id}
                        draggable={
                          !busy &&
                          !task.isBlocked &&
                          !task.isCancelled &&
                          task.status !== "done"
                        }
                        onDragStart={(e) =>
                          e.dataTransfer.setData("text/plain", task.id)
                        }
                        className={`surface-card p-4 transition hover:shadow-md ${task.isCancelled ? "opacity-60" : ""}`}
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`rounded-md px-2 py-1 text-[10px] font-semibold priority-${task.priority}`}
                          >
                            {priorities[task.priority]}
                          </span>
                          {task.isBlocked && (
                            <span className="flex items-center gap-1 text-[11px] font-semibold text-red-700">
                              <Flag size={12} />
                              Bloqueada
                            </span>
                          )}
                          {task.isCancelled && (
                            <span className="text-xs text-neutral-500">
                              Cancelada
                            </span>
                          )}
                        </div>
                        <button
                          className="mt-3 block w-full text-left text-sm font-semibold leading-5 hover:text-emerald-700"
                          onClick={() => setSelected(task.id)}
                        >
                          {task.title}
                        </button>
                        <p className="mt-2 flex items-center gap-1 text-xs text-neutral-500">
                          <MapPin size={12} />
                          {task.location}
                        </p>
                        <p className="mt-2 text-[11px] text-neutral-500">
                          {task.dueDate}
                        </p>
                        <p className="mt-2 text-xs text-neutral-500">{task.estimatedHours !== null ? `${task.estimatedHours} h por persona · ` : ""}{task.autonomy === "assisted" ? "Requiere acompañamiento" : task.autonomy === "independent" ? "Trabajo autónomo" : "Autonomía sin definir"}{task.limitingTools ? ` · ${task.limitingTools}` : ""}</p>
                        {progressLogs.length > 0 && <p className="mt-2 text-xs text-neutral-500">Avances de cuadrilla: {task.targetQuantity !== null ? `${progressQuantity} ${task.unit} · ` : ""}{progressHours} horas-persona registradas</p>}
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {task.assignees.map((id) => (
                            <span
                              key={id}
                              title={task.assigneeNames[id] || person(id)}
                              className="grid size-7 place-items-center rounded-full border border-white bg-emerald-100 text-[10px] font-semibold text-emerald-800"
                            >
                              {(task.assigneeNames[id] || person(id))
                                .split(/\s+/)
                                .slice(0, 2)
                                .map((p) => p[0])
                                .join("")}
                            </span>
                          ))}
                        </div>
                        {task.targetQuantity !== null && (
                          <div className="mt-3 text-[11px] text-neutral-500">
                            <p>
                              {accepted?.accepted
                                ? accepted.acceptedQuantity
                                : (log?.quantity ?? 0)}{" "}
                              / {task.targetQuantity} {task.unit}{" "}
                              {accepted?.accepted ? "aceptado" : "reportado"}
                            </p>
                            <progress
                              max={task.targetQuantity}
                              value={
                                accepted?.accepted
                                  ? (accepted.acceptedQuantity ?? 0)
                                  : (log?.quantity ?? 0)
                              }
                              className="mt-1 h-1.5 w-full accent-emerald-600"
                            />
                          </div>
                        )}
                        {task.isBlocked && (
                          <p className="mt-2 text-xs text-red-700">
                            {task.blockReason}
                          </p>
                        )}
                        <div className="mt-3 flex items-center gap-2">
                          <button
                            className="f-button !min-h-9 !px-2 text-xs"
                            onClick={() => setSelected(task.id)}
                          >
                            <History size={13} />
                            Ver tarea
                          </button>
                          {!task.isBlocked &&
                            !task.isCancelled &&
                            task.status === "todo" && (
                              <button
                                aria-label={`Iniciar ${task.title}`}
                                disabled={busy}
                                className="f-button !min-h-9 !px-2 text-xs"
                                onClick={() =>
                                  void command(task, { action: "start" })
                                }
                              >
                                <Play size={13} />
                                Iniciar
                              </button>
                            )}
                        </div>
                      </article>
                    );
                  })}
                {!tasks.some((t) => t.status === status) && (
                  <p className="rounded-xl border border-dashed border-neutral-300 p-5 text-center text-xs text-neutral-500">
                    Sin tareas en esta columna
                  </p>
                )}
              </div>
            </section>
          ),
        )}
      </div>
      <p className="flex items-start gap-2 text-xs leading-5 text-neutral-500">
        <Clock3 size={15} className="shrink-0" />
        Los tiempos se registran de forma explícita. Los resultados de cuadrilla
        se presentan como resultado grupal. El tablero no modifica asistencia,
        tarifas ni nómina.
      </p>
      {filter && data && (
        <section className="surface-card p-5">
          <h2 className="flex items-center gap-2 font-semibold">
            <History size={18} />
            Historial de {person(filter)}
          </h2>
          <EventList
            events={data.events.filter((e) => e.assignees.includes(filter))}
            tasks={data.tasks}
          />
        </section>
      )}
      {current && (
        <Modal title={current.title} close={() => setSelected(undefined)}>
          <div className="space-y-3 text-sm">
            <p className="text-xs font-semibold text-emerald-700">
              {columns[current.status]} · {priorities[current.priority]} ·{" "}
              {current.dueDate}
            </p>
            <p>
              {current.activity} · {current.location}
            </p>
            <p>
              {current.assignees
                .map((id) => current.assigneeNames[id] || person(id))
                .join(", ")}
            </p>
            <p className="whitespace-pre-wrap text-neutral-600">
              {current.instructions || "Sin instrucciones adicionales"}
            </p>
            <p>
              <strong>Criterio de aceptación:</strong>{" "}
              {current.acceptanceCriteria}
            </p>
            {current.isBlocked && (
              <p className="text-red-700">Bloqueo: {current.blockReason}</p>
            )}
            {current.isCancelled && <p>Cancelación: {current.cancelReason}</p>}
            {actions(current)}
            <h3 className="border-t border-neutral-200 pt-5 font-semibold">
              Cierres y revisiones
            </h3>
            {data?.logs
              .filter((l) => l.taskId === current.id)
              .map((log) => (
                <article
                  className="rounded-xl border border-neutral-200 p-4"
                  key={log.id}
                >
                  <p>{log.result}</p>
                  <p className="mt-2 text-xs text-neutral-500">
                    {dateLabel(log.workDate)} · Criterio{" "}
                    {log.criterionMet ? "cumplido" : "pendiente"}
                    {log.quantity !== null
                      ? ` · ${log.quantity} ${current.unit}`
                      : ""}
                  </p>
                  {Object.entries(log.minutes).map(([id, minutes]) => (
                    <p className="mt-1 text-xs" key={id}>
                      {current.assigneeNames[id] || person(id)}: {minutes}{" "}
                      minutos reales
                    </p>
                  ))}
                  {Object.entries(log.minutes).some(
                    ([id]) =>
                      (data?.logs ?? [])
                        .filter(
                          (l) =>
                            dateLabel(l.workDate).split(",")[0] ===
                            dateLabel(log.workDate).split(",")[0],
                        )
                        .reduce((sum, l) => sum + (l.minutes[id] ?? 0), 0) >
                      480,
                  ) && (
                    <p className="mt-2 text-xs text-amber-700">
                      Hay personas con más de 8 h registradas en esta fecha.
                      Verifica el cierre.
                    </p>
                  )}
                  {log.incidents && (
                    <p className="mt-2 text-xs">Incidencias: {log.incidents}</p>
                  )}
                  <div className="mt-2 flex flex-wrap gap-2">
                    {log.evidence.map((path, i) => (
                      <button
                        key={path}
                        className="f-button"
                        onClick={() =>
                          void evidenceUrl(path)
                            .then((url) => {
                              window.open(url, "_blank", "noopener,noreferrer");
                            })
                            .catch(() =>
                              setError("No se pudo abrir la evidencia."),
                            )
                        }
                      >
                        <Paperclip size={14} />
                        Evidencia {i + 1}
                      </button>
                    ))}
                  </div>
                  {data?.reviews
                    .filter((r) => r.logId === log.id)
                    .map((r) => (
                      <p
                        className="mt-3 border-t border-neutral-200 pt-3 text-xs"
                        key={r.id}
                      >
                        {r.accepted ? "Aceptado" : "Devuelto"} ·{" "}
                        {dateLabel(r.createdAt)} ·{" "}
                        {r.observations || "Sin observaciones"}
                        {r.acceptedQuantity !== null
                          ? ` · ${r.acceptedQuantity} ${current.unit} aceptados`
                          : ""}
                      </p>
                    ))}
                </article>
              ))}
            {(() => {
              const result = productivity(
                current,
                taskLog(current),
                taskReview(current),
                data?.logs,
              );
              return (
                <p className="text-xs text-neutral-500">
                  {result.label}
                  {result.value !== null
                    ? `: ${result.value.toFixed(2)} ${current.unit}/h`
                    : ""}
                </p>
              );
            })()}
            <h3 className="border-t border-neutral-200 pt-5 font-semibold">
              Trazabilidad
            </h3>
            <EventList
              events={data?.events.filter((e) => e.taskId === current.id) ?? []}
              tasks={data?.tasks ?? []}
            />
          </div>
        </Modal>
      )}
      {editor && (
        <Modal
          title={editor.task ? "Editar planificación" : "Crear tarea"}
          close={() => {
            if (!busy) setEditor(null);
          }}
        >
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              const plan = editor.plan;
              if (
                plan.assignees.some(
                  (id) => workers.find((w) => w.id === id)?.status !== "active",
                )
              ) {
                setError("No se permite asignar personal inactivo.");
                return;
              }
              if (editor.task)
                void command(editor.task, { action: "edit", plan }, () =>
                  setEditor(null),
                );
              else
                void execute(
                  `create:${JSON.stringify(plan)}`,
                  (id) => createWorkTask(user, plan, id, id),
                  () => setEditor(null),
                );
            }}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              {(
                [
                  ["title", "Título"],
                  ["activity", "Tipo de labor"],
                  ["location", "Sector / lote"],
                ] as const
              ).map(([key, label]) => (
                <Field key={key} label={label}>
                  <input
                    required
                    maxLength={
                      key === "title" ? 160 : key === "activity" ? 120 : 200
                    }
                    className="f-input"
                    value={editor.plan[key]}
                    onChange={(e) =>
                      setEditor({
                        ...editor,
                        plan: { ...editor.plan, [key]: e.target.value },
                      })
                    }
                  />
                </Field>
              ))}
              <Field label="Unidad / proyecto existente">
                <select
                  className="f-input"
                  value={editor.plan.project}
                  onChange={(e) =>
                    setEditor({
                      ...editor,
                      plan: { ...editor.plan, project: e.target.value },
                    })
                  }
                >
                  <option value="">Operación general de la finca</option>
                  {units.map((u) => (
                    <option key={u.id} value={u.id}>
                      {text(u.name)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Fecha prevista">
                <input
                  required
                  type="date"
                  className="f-input"
                  value={editor.plan.dueDate}
                  onChange={(e) =>
                    setEditor({
                      ...editor,
                      plan: { ...editor.plan, dueDate: e.target.value },
                    })
                  }
                />
              </Field>
              <Field label="Prioridad">
                <select
                  className="f-input"
                  value={editor.plan.priority}
                  onChange={(e) =>
                    setEditor({
                      ...editor,
                      plan: {
                        ...editor.plan,
                        priority: e.target.value as Plan["priority"],
                      },
                    })
                  }
                >
                  {Object.entries(priorities).map(([v, label]) => (
                    <option key={v} value={v}>
                      {label}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <fieldset className="rounded-xl border border-neutral-200 p-3">
              <legend className="px-1 text-xs font-semibold">
                Personal registrado · selecciona hasta 6
              </legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {workers.map((w) => (
                  <label
                    key={w.id}
                    className={`flex min-h-10 items-center gap-2 text-xs ${w.status !== "active" ? "text-neutral-400" : ""}`}
                  >
                    <input
                      type="checkbox"
                      disabled={w.status !== "active"}
                      checked={editor.plan.assignees.includes(w.id)}
                      onChange={(e) => {
                        const ids = e.target.checked
                          ? [...editor.plan.assignees, w.id]
                          : editor.plan.assignees.filter((id) => id !== w.id);
                        setEditor({
                          ...editor,
                          plan: {
                            ...editor.plan,
                            assignees: ids,
                            assigneeNames: Object.fromEntries(
                              ids.map((id) => [id, person(id)]),
                            ),
                          },
                        });
                      }}
                    />
                    {fullName(w)}
                    {w.status !== "active" ? " · Inactivo" : ""}
                  </label>
                ))}
              </div>
            </fieldset>
            <Field label="Instrucciones">
              <textarea
                className="f-input min-h-20"
                maxLength={4000}
                value={editor.plan.instructions}
                onChange={(e) =>
                  setEditor({
                    ...editor,
                    plan: { ...editor.plan, instructions: e.target.value },
                  })
                }
              />
            </Field>
            <Field label="Criterio de aceptación">
              <textarea
                required
                maxLength={2000}
                className="f-input min-h-20"
                value={editor.plan.acceptanceCriteria}
                onChange={(e) =>
                  setEditor({
                    ...editor,
                    plan: {
                      ...editor.plan,
                      acceptanceCriteria: e.target.value,
                    },
                  })
                }
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Meta numérica (opcional)">
                <input
                  type="number"
                  min="0.001"
                  step="any"
                  className="f-input"
                  value={editor.plan.targetQuantity ?? ""}
                  onChange={(e) =>
                    setEditor({
                      ...editor,
                      plan: {
                        ...editor.plan,
                        targetQuantity: e.target.value
                          ? Number(e.target.value)
                          : null,
                      },
                    })
                  }
                />
              </Field>
              <Field label="Unidad de medida">
                <input
                  maxLength={60}
                  required={editor.plan.targetQuantity !== null}
                  className="f-input"
                  value={editor.plan.unit}
                  onChange={(e) =>
                    setEditor({
                      ...editor,
                      plan: { ...editor.plan, unit: e.target.value },
                    })
                  }
                />
              </Field>
              <Field label="Horas previstas por persona">
                <input
                  type="number"
                  step="0.25"
                  min="0.25"
                  max="24"
                  className="f-input"
                  value={editor.plan.estimatedHours ?? ""}
                  onChange={(e) =>
                    setEditor({
                      ...editor,
                      plan: {
                        ...editor.plan,
                        estimatedHours: e.target.value
                          ? Number(e.target.value)
                          : null,
                      },
                    })
                  }
                />
              </Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Autonomía requerida">
                <select className="f-input" value={editor.plan.autonomy ?? ""} onChange={(e) => {
                  const { autonomy: ignored, ...rest } = editor.plan;
                  void ignored;
                  setEditor({ ...editor, plan: e.target.value ? { ...rest, autonomy: e.target.value as NonNullable<Plan["autonomy"]> } : rest });
                }}>
                  <option value="">Sin definir</option><option value="independent">Independiente</option><option value="assisted">Requiere acompañamiento</option>
                </select>
              </Field>
              <Field label="Herramientas limitantes">
                <input className="f-input" maxLength={200} value={editor.plan.limitingTools ?? ""} onChange={(e) => setEditor({ ...editor, plan: { ...editor.plan, limitingTools: e.target.value } })} placeholder="Ej. motobomba" />
              </Field>
            </div>
            {warnings(editor.plan).map((w) => (
              <p
                key={w}
                className="flex gap-2 rounded-lg bg-amber-50 p-3 text-xs text-amber-800"
              >
                <AlertTriangle size={15} className="shrink-0" />
                {w}
              </p>
            ))}
            {error && (
              <p role="alert" className="text-sm text-red-700">
                {error}
              </p>
            )}
            <button disabled={busy} className="f-button f-primary">
              {busy
                ? "Guardando…"
                : editor.task
                  ? "Guardar planificación"
                  : "Crear tarea"}
            </button>
          </form>
        </Modal>
      )}
      {closing && (
        <CloseForm
          task={closing}
          mode={closeMode}
          busy={busy}
          error={error}
          close={() => {
            if (!busy) setClosing(undefined);
          }}
          submit={(value) =>
            command(closing, { action: closeMode, log: value }, () =>
              setClosing(undefined),
            )
          }
        />
      )}
      {reviewing && (
        <Modal
          title={`Revisar: ${reviewing.title}`}
          close={() => {
            if (!busy) setReviewing(undefined);
          }}
        >
          <ReviewForm
            task={reviewing}
            log={taskLog(reviewing)}
            progressLogs={(data?.logs ?? []).filter((entry) => (data?.events ?? []).some((event) => event.taskId === reviewing.id && event.action === "progress" && event.id === entry.id))}
            busy={busy}
            error={error}
            submit={(action, observations, acceptedQuantity) =>
              command(
                reviewing,
                { action, observations, acceptedQuantity },
                () => setReviewing(undefined),
              )
            }
          />
        </Modal>
      )}
      {reasonAction && (
        <Modal
          title={
            reasonAction.action === "cancel"
              ? "Cancelar conservando historial"
              : reasonAction.action === "block"
                ? "Bloquear tarea"
                : "Resolver bloqueo"
          }
          close={() => {
            if (!busy) setReasonAction(undefined);
          }}
        >
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              const reason = String(
                new FormData(e.currentTarget).get("reason") || "",
              );
              void command(
                reasonAction.task,
                { action: reasonAction.action, reason },
                () => setReasonAction(undefined),
              );
            }}
          >
            <Field label="Motivo obligatorio">
              <textarea
                className="f-input min-h-24"
                name="reason"
                required
                maxLength={2000}
              />
            </Field>
            {error && (
              <p role="alert" className="text-sm text-red-700">
                {error}
              </p>
            )}
            <button disabled={busy} className="f-button f-primary">
              Confirmar
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}
function EventList({
  events,
  tasks,
}: {
  events: Loaded["events"];
  tasks: WorkTask[];
}) {
  const labels: Record<string, string> = {
    create: "Planificada",
    edit: "Planificación corregida",
    start: "Iniciada",
    submit: "Cierre registrado",
    accept: "Aceptada",
    return: "Devuelta para corrección",
    block: "Bloqueada",
    unblock: "Bloqueo resuelto",
    cancel: "Cancelada",
  };
  return (
    <ol className="mt-4 space-y-3">
      {[...events]
        .sort((a, b) => {
          const time = (v: unknown) =>
            v && typeof v === "object" && "toMillis" in v
              ? (v as { toMillis(): number }).toMillis()
              : 0;
          return (
            time(b.createdAt) - time(a.createdAt) || b.revision - a.revision
          );
        })
        .map((e) => (
          <li key={e.id} className="border-l-2 border-emerald-200 pl-3 text-xs">
            <p className="font-semibold">
              {labels[e.action] || e.action} ·{" "}
              {tasks.find((t) => t.id === e.taskId)?.title}
            </p>
            <p className="mt-1 text-neutral-500">
              {dateLabel(e.createdAt)} · revisión {e.revision} ·{" "}
              {columns[e.toStatus]}
            </p>
            {e.reason && <p className="mt-1 whitespace-pre-wrap">{e.reason}</p>}
            <p className="mt-1 break-all text-[10px] text-neutral-400">
              Por {e.actorLabel || "Cuenta autorizada"}
            </p>
          </li>
        ))}
      {!events.length && (
        <li className="text-xs text-neutral-500">Sin actividad registrada.</li>
      )}
    </ol>
  );
}
function CloseForm({
  task,
  mode,
  busy,
  error,
  close,
  submit,
}: {
  task: WorkTask;
  mode: "submit" | "progress";
  busy: boolean;
  error: string;
  close(): void;
  submit(value: Extract<Command, { action: "submit" | "progress" }>["log"]): Promise<void>;
}) {
  const [uploading, setUploading] = useState(false),
    [localError, setLocalError] = useState("");
  const uploaded = useRef(new Map<string, string>());
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (uploading || busy) return;
    const form = new FormData(e.currentTarget);
    setLocalError("");
    setUploading(true);
    try {
      const files = form
        .getAll("evidence")
        .filter((v): v is File => v instanceof File && v.size > 0);
      if (files.length > 5) throw Error("Adjunta como máximo cinco archivos.");
      const evidence = [];
      for (const file of files) {
        const key = `${file.name}:${file.size}:${file.lastModified}`;
        let path = uploaded.current.get(key);
        if (!path) {
          path = await uploadEvidence(task.id, file, crypto.randomUUID());
          uploaded.current.set(key, path);
        }
        evidence.push(path);
      }
      await submit({
        result: String(form.get("result")),
        criterionMet: form.get("criterionMet") === "on",
        quantity:
          task.targetQuantity === null ? null : Number(form.get("quantity")),
        minutes: Object.fromEntries(
          task.assignees.map((id) => [id, Number(form.get(`minutes:${id}`))]),
        ),
        incidents: String(form.get("incidents") || ""),
        evidence,
        workDate: new Date(`${form.get("date")}T00:00:00-06:00`),
      });
    } catch (e) {
      setLocalError(
        e instanceof Error && !e.message.includes("Firebase")
          ? e.message
          : "No se pudo adjuntar la evidencia. Reintenta con conexión.",
      );
    } finally {
      setUploading(false);
    }
  }
  return (
    <Modal title={`${mode === "progress" ? "Avance del día" : "Cierre de jornada"}: ${task.title}`} close={close}>
      <form onSubmit={(e) => void save(e)} className="space-y-4">
        <p className="rounded-lg bg-neutral-100 p-3 text-xs">
          Criterio: {task.acceptanceCriteria}.{" "}
          {task.assignees.length > 1
            ? "Registra minutos reales de cada integrante. La cantidad pertenece a la cuadrilla."
            : "Registra el tiempo dedicado; no se calcula por la posición de la tarjeta."}
        </p>
        <Field label="Fecha trabajada">
          <input
            required
            name="date"
            type="date"
            max={fincaDate()}
            defaultValue={fincaDate()}
            className="f-input"
          />
        </Field>
        <Field label="Resultado observado">
          <textarea
            required
            name="result"
            maxLength={4000}
            className="f-input min-h-24"
          />
        </Field>
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input type="checkbox" name="criterionMet" />
          Se cumplió el criterio de aceptación
        </label>
        {task.targetQuantity !== null && (
          <Field label={`Cantidad realizada (${task.unit}), puede ser 0`}>
            <input
              name="quantity"
              required
              type="number"
              min="0"
              step="any"
              className="f-input"
            />
          </Field>
        )}
        <fieldset className="space-y-3 rounded-xl border border-neutral-200 p-3">
          <legend className="px-1 text-xs font-semibold">
            Tiempo real por persona
          </legend>
          {task.assignees.map((id) => (
            <Field key={id} label={`${task.assigneeNames[id]} · minutos`}>
              <input
                required
                name={`minutes:${id}`}
                type="number"
                min="1"
                max="1440"
                step="1"
                className="f-input"
              />
            </Field>
          ))}
        </fieldset>
        <Field label="Incidencias">
          <textarea name="incidents" maxLength={4000} className="f-input" />
        </Field>
        <Field label="Evidencias · hasta 5 archivos de 5 MB">
          <input
            type="file"
            name="evidence"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            multiple
            className="f-input"
          />
        </Field>
        {(error || localError) && (
          <p role="alert" className="text-sm text-red-700">
            {localError || error}
          </p>
        )}
        <button disabled={busy || uploading} className="f-button f-primary">
          <Send size={16} />
          {busy || uploading ? "Guardando…" : mode === "progress" ? "Guardar avance" : "Enviar a revisión"}
        </button>
      </form>
    </Modal>
  );
}
function ReviewForm({
  task,
  log,
  progressLogs,
  busy,
  error,
  submit,
}: {
  task: WorkTask;
  log?: Loaded["logs"][number];
  progressLogs: Loaded["logs"];
  busy: boolean;
  error: string;
  submit(
    action: "accept" | "return",
    observations: string,
    quantity: number | null,
  ): Promise<void>;
}) {
  const [action, setAction] = useState<"accept" | "return">("accept");
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        void submit(
          action,
          String(data.get("observations") || ""),
          task.targetQuantity === null || action === "return"
            ? null
            : Number(data.get("quantity")),
        );
      }}
    >
      <p className="text-sm">{log?.result}</p>
      <p className="text-sm">Avances parciales: {progressLogs.reduce((sum, entry) => sum + (entry.quantity ?? 0), 0)} {task.unit} · {progressLogs.reduce((sum, entry) => sum + Object.values(entry.minutes).reduce((n, minutes) => n + minutes, 0), 0)} minutos-persona.</p>
      <p className="text-xs text-neutral-500">
        Criterio: {log?.criterionMet ? "Cumplido" : "No cumplido"} ·{" "}
        {Object.values(log?.minutes ?? {}).reduce((a, b) => a + b, 0)}{" "}
        minutos-persona reportados.
      </p>
      <Field label="Decisión">
        <select
          className="f-input"
          value={action}
          onChange={(e) => setAction(e.target.value as typeof action)}
        >
          <option value="accept">Aceptar y finalizar</option>
          <option value="return">Devolver para corrección</option>
        </select>
      </Field>
      {action === "accept" && task.targetQuantity !== null && (
        <Field
          label={`Cantidad aceptada · máximo ${log?.quantity ?? 0} ${task.unit}`}
        >
          <input
            required
            name="quantity"
            type="number"
            min="0"
            max={log?.quantity ?? 0}
            step="any"
            defaultValue={log?.quantity ?? 0}
            className="f-input"
          />
        </Field>
      )}
      <Field label="Observaciones">
        <textarea
          required={action === "return"}
          name="observations"
          maxLength={4000}
          className="f-input min-h-24"
        />
      </Field>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      <button disabled={busy} className="f-button f-primary">
        {action === "accept" ? "Aceptar cierre" : "Devolver tarea"}
      </button>
    </form>
  );
}

export function WorkerActions({
  user,
  worker,
  changed,
}: {
  user: AuthUser;
  worker: CloudRow;
  changed(): void;
}) {
  const [open, setOpen] = useState(false),
    [inactive, setInactive] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const pending = useRef(new Map<string, string>());
  if (user.role !== "ADMIN") return null;
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    const f = new FormData(e.currentTarget);
    const patch: WorkerPatch = {
      firstName: String(f.get("firstName")),
      lastName: String(f.get("lastName")),
      age: Number(f.get("age")),
      area: String(f.get("area") || ""),
      profile: String(f.get("profile") || ""),
      status: inactive
        ? "inactive"
        : worker.status === "inactive"
          ? "inactive"
          : "active",
    };
    const reason = String(f.get("reason") || "");
    const key = JSON.stringify({ patch, reason });
    const id = pending.current.get(key) ?? crypto.randomUUID();
    pending.current.set(key, id);
    setBusy(true);
    setError("");
    try {
      await adjustWorker(
        user,
        worker.id,
        patch,
        Number(worker.revision) || 0,
        id,
        reason,
      );
      setOpen(false);
      changed();
    } catch {
      setError("No se confirmó el cambio. Actualiza o reintenta con conexión.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          className="f-button"
          onClick={() => {
            setInactive(false);
            setOpen(true);
          }}
        >
          <Pencil size={14} />
          Editar
        </button>
        {worker.status === "active" && (
          <button
            className="f-button text-red-700"
            onClick={() => {
              setInactive(true);
              setOpen(true);
            }}
          >
            <Ban size={14} />
            Inactivar
          </button>
        )}
        <a
          href={`/dashboard/workforce?worker=${encodeURIComponent(worker.id)}`}
          className="f-button"
        >
          <History size={14} />
          Historial
        </a>
      </div>
      {open && (
        <Modal
          title={inactive ? "Inactivar trabajador" : "Editar perfil operativo"}
          close={() => {
            if (!busy) setOpen(false);
          }}
        >
          <form onSubmit={(e) => void save(e)} className="space-y-4">
            <p className="text-xs text-neutral-500">
              El cambio se guarda como una revisión auditada vinculada a la
              ficha original. No modifica salarios, períodos ni asistencia.
            </p>
            {(
              [
                ["firstName", "Nombres"],
                ["lastName", "Apellidos"],
                ["age", "Edad"],
                ["area", "Cargo / área"],
                ["profile", "Perfil"],
              ] as const
            ).map(([key, label]) => (
              <Field label={label} key={key}>
                <input
                  className="f-input"
                  name={key}
                  required={["firstName", "lastName", "age"].includes(key)}
                  type={key === "age" ? "number" : "text"}
                  min={key === "age" ? 18 : undefined}
                  max={key === "age" ? 100 : undefined}
                  maxLength={
                    key === "profile" ? 2000 : key === "area" ? 60 : 70
                  }
                  defaultValue={String(worker[key] ?? "")}
                />
              </Field>
            ))}
            <Field label="Motivo del cambio">
              <textarea
                required
                name="reason"
                maxLength={2000}
                className="f-input"
              />
            </Field>
            {error && (
              <p role="alert" className="text-sm text-red-700">
                {error}
              </p>
            )}
            <button disabled={busy} className="f-button f-primary">
              {busy
                ? "Guardando…"
                : inactive
                  ? "Confirmar inactivación"
                  : "Guardar revisión"}
            </button>
          </form>
        </Modal>
      )}
    </>
  );
}
export function WorkforceAccounts({
  user,
  workers,
}: {
  user: AuthUser;
  workers: CloudRow[];
}) {
  const [rows, setRows] = useState<CloudRow[]>(),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    void workforceUsers(user)
      .then(setRows)
      .catch(() => setError("No se pudieron consultar las cuentas."));
  }, [user]);
  return (
    <section className="mt-6 space-y-4">
      <p className="text-sm text-neutral-500">
        Solo se vinculan cuentas de trabajador ya existentes en Firebase
        Authentication y Firestore. No se crean identidades ni contraseñas desde
        el navegador.
      </p>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      {rows?.map((row) => (
        <article key={row.id} className="surface-card p-5">
          <h2 className="font-semibold">
            {text(row.displayName) || "Cuenta registrada"}
          </h2>
          <p className="mt-1 text-xs text-neutral-500">
            {text(row.role)} · {row.active ? "Activa" : "Inactiva"}
          </p>
          {row.role === "worker" && row.active === true && (
            <form
              className="mt-3 flex flex-wrap gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (busy) return;
                const id = String(new FormData(e.currentTarget).get("worker"));
                setBusy(true);
                void bindWorkforceAccount(user, row.id, id)
                  .then(() => setError("Vínculo permanente guardado."))
                  .catch(() =>
                    setError(
                      "No se pudo vincular. Comprueba si ya existe un vínculo.",
                    ),
                  )
                  .finally(() => setBusy(false));
              }}
            >
              <select
                required
                name="worker"
                aria-label="Ficha de trabajador"
                className="f-input"
              >
                <option value="">Selecciona la ficha real</option>
                {workers
                  .filter((w) => w.status === "active")
                  .map((w) => (
                    <option key={w.id} value={w.id}>
                      {fullName(w)}
                    </option>
                  ))}
              </select>
              <button disabled={busy} className="f-button f-primary">
                <Users size={14} />
                Vincular cuenta
              </button>
            </form>
          )}
        </article>
      ))}
      {rows?.length === 0 && (
        <p className="text-sm text-neutral-500">No hay cuentas disponibles.</p>
      )}
      <p className="text-xs text-neutral-500">
        <ListTodo size={14} className="mr-1 inline" />
        Administrador: salarios, finanzas y aceptación. Encargado: planificación
        y cierres. Trabajador: tareas vinculadas y cierres individuales.
      </p>
    </section>
  );
}
