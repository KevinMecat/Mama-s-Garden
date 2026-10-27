"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  ArrowUpRight,
  Bell,
  ChevronDown,
  CircleHelp,
  FolderKanban,
  LayoutDashboard,
  Leaf,
  LogOut,
  Menu,
  Package,
  Plus,
  Search,
  Settings2,
  Sprout,
  Users,
  Wallet,
  Wheat,
  X,
  CalendarCheck,
  ShoppingBasket,
  ListTodo,
  RotateCcw,
} from "lucide-react";
import { logout } from "@/lib/auth-api";
import { isDemoMode, isFirebaseMode } from "@/lib/api-client";
import { resetDemo } from "@/lib/demo-api";
import { getProjects, getEmployees } from "@/lib/page-api";
import type { AuthUser } from "@/types/auth";

const groups = [
  {
    title: "Espacio de trabajo",
    links: [{ href: "/dashboard", label: "Resumen", icon: LayoutDashboard }],
  },
  {
    title: "Operaciones",
    links: [
      { href: "/dashboard/workforce", label: "Trabajo de hoy", icon: ListTodo },
      {
        href: "/dashboard/projects",
        label: isFirebaseMode() ? "Unidades" : "Proyectos",
        icon: FolderKanban,
      },
      { href: "/dashboard/crews", label: "Cuadrillas", icon: Users },
      { href: "/dashboard/production", label: "Producción", icon: Wheat },
      {
        href: "/dashboard/attendance",
        label: "Asistencia",
        icon: CalendarCheck,
      },
    ],
  },
  {
    title: "Administración",
    links: [
      {
        href: "/dashboard/finance",
        label: "Finanzas",
        icon: Wallet,
        admin: true,
      },
      {
        href: "/dashboard/payroll",
        label: "Nómina",
        icon: Wallet,
        admin: true,
      },
      {
        href: "/dashboard/employees",
        label: "Personal",
        icon: Users,
        admin: true,
      },
      { href: "/dashboard/products", label: "Productos", icon: Package },
      {
        href: "/dashboard/sales",
        label: "Ventas",
        icon: ShoppingBasket,
        admin: true,
      },
    ],
  },
  {
    title: "Preferencias",
    links: [
      { href: "/dashboard/settings", label: "Configuración", icon: Settings2 },
    ],
  },
];
type SearchResult = { href: string; label: string; context: string };

export function DashboardNavigation({ user }: { user: AuthUser }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [records, setRecords] = useState<SearchResult[]>([]);
  const [searchError, setSearchError] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const header = useRef<HTMLElement>(null);
  const admin = user.role === "ADMIN";
  const name = user.first_name.trim() || user.email;
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
  const firebaseRoutes: Record<string, string[]> = {
    ADMIN: ["overview", "workforce", "projects", "crews", "production", "attendance", "finance", "payroll", "employees", "products", "sales", "settings"],
    MANAGER: ["overview", "projects", "finance", "sales", "attendance", "settings"],
    SUPERVISOR: ["overview", "workforce", "employees", "crews", "attendance", "settings"],
    WORKER: ["overview", "projects", "attendance", "settings"],
  };
  const visibleGroups = groups.map(group => ({ ...group, links: group.links.filter(link => isFirebaseMode()
    ? firebaseRoutes[user.role]?.includes(link.href.split("/")[2] || "overview")
    : !("admin" in link && link.admin) || admin) }));
  const pages = visibleGroups.flatMap((group) =>
    group.links.map((link) => ({
      href: link.href,
      label: link.label,
      context: group.title,
    })),
  );
  const results = [...pages, ...records]
    .filter((item) =>
      `${item.label} ${item.context}`
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .includes(
          query
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase(),
        ),
    )
    .slice(0, 14);

  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen((open) => !open);
      }
      if (event.key === "Escape") {
        setMobileOpen(false);
        header.current
          ?.querySelectorAll("details[open]")
          .forEach((menu) => menu.removeAttribute("open"));
      }
    };
    const closeMenus = (event: PointerEvent) => {
      header.current?.querySelectorAll("details[open]").forEach((menu) => {
        if (event.target instanceof Node && !menu.contains(event.target))
          menu.removeAttribute("open");
      });
    };
    window.addEventListener("keydown", shortcut);
    document.addEventListener("pointerdown", closeMenus);
    return () => {
      window.removeEventListener("keydown", shortcut);
      document.removeEventListener("pointerdown", closeMenus);
    };
  }, []);
  useEffect(() => {
    if (!searchOpen) {
      dialog.current?.close();
      return;
    }
    dialog.current?.showModal();
    let active = true;
    const loadRecords = isFirebaseMode()
      ? import("@/lib/firebase-client").then((module) =>
          module.searchFirebaseRecords(user),
        )
      : Promise.all([
          getProjects(),
          admin ? getEmployees() : Promise.resolve([]),
        ]).then(([projects, employees]) => [
          ...projects.map((item) => ({
            href: `/dashboard/projects/detail?id=${item.id}`,
            label: item.name,
            context: "Proyecto",
          })),
          ...employees.map((item) => ({
            href: `/dashboard/employees/edit?id=${item.id}`,
            label: item.full_name,
            context: "Personal",
          })),
        ]);
    loadRecords
      .then((items) => {
        if (active) {
          setSearchError(false);
          setRecords(items);
        }
      })
      .catch(() => {
        if (active) setSearchError(true);
      });
    return () => {
      active = false;
    };
  }, [searchOpen, admin, user]);

  async function signOut() {
    setClosing(true);
    try {
      await logout();
      window.dispatchEvent(new Event("finca:auth-changed"));
      router.replace("/login");
    } finally {
      setClosing(false);
    }
  }
  function navigate() {
    setMobileOpen(false);
    setSearchOpen(false);
    setQuery("");
  }

  return (
    <>
      <a
        href="#dashboard-content"
        className="fixed left-4 top-2 z-[100] -translate-y-20 rounded-lg bg-white px-4 py-2 text-sm font-semibold focus:translate-y-0"
      >
        Saltar al contenido
      </a>
      <header
        ref={header}
        onClick={(event) => {
          if (event.target instanceof Element && event.target.closest("a"))
            header.current
              ?.querySelectorAll("details[open]")
              .forEach((menu) => menu.removeAttribute("open"));
        }}
        className="fixed inset-x-0 top-0 z-40 flex h-14 items-center gap-2 border-b border-white/10 bg-[#123b30] px-3 text-white shadow-sm lg:gap-4 lg:px-5"
      >
        <button
          type="button"
          aria-label={mobileOpen ? "Cerrar navegación" : "Abrir navegación"}
          aria-expanded={mobileOpen}
          aria-controls="dashboard-sidebar"
          className="nav-icon-button lg:hidden"
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
        <Link
          href="/dashboard"
          aria-label="Inicio de Mama's Garden"
          className="flex shrink-0 items-center gap-2.5 rounded-lg"
        >
          <span className="grid size-8 place-items-center rounded-lg bg-white">
            <Image src="/brand/logo.svg" alt="" width={27} height={27} />
          </span>
          <span className="hidden text-sm font-semibold tracking-tight sm:block">
            Mama&apos;s Garden
          </span>
        </Link>
        <div className="hidden h-6 w-px bg-white/15 lg:block" />
        <details className="relative hidden lg:block">
          <summary className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm font-medium hover:bg-white/10">
            Finca principal <ChevronDown size={14} />
          </summary>
          <div className="menu-panel left-0 right-auto">
            <p className="px-3 py-2 text-xs font-semibold text-neutral-500">
              Espacios de trabajo
            </p>
            <Link href="/dashboard" className="menu-item">
              <Leaf size={16} className="text-emerald-700" /> Finca Mama&apos;s
              Garden <span className="ml-auto text-emerald-700">✓</span>
            </Link>
          </div>
        </details>
        <button
          type="button"
          onClick={() => setSearchOpen(true)}
          className="ml-auto flex h-9 min-w-0 flex-1 items-center gap-2 rounded-lg border border-white/15 bg-white/10 px-3 text-left text-sm text-white/70 transition hover:bg-white/15 sm:mx-auto sm:max-w-md"
          aria-label="Buscar en la finca (Ctrl + K)"
        >
          <Search size={16} className="shrink-0" />
          <span className="truncate">Buscar en la finca...</span>
          <kbd className="ml-auto hidden rounded border border-white/20 px-1.5 py-0.5 text-[10px] font-sans sm:block">
            Ctrl K
          </kbd>
        </button>
        {!isFirebaseMode() && (
          <>
            <details className="relative shrink-0">
              <summary
                aria-label="Crear"
                className="flex h-9 items-center gap-1.5 rounded-lg bg-emerald-500 px-2.5 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-400 sm:px-3"
              >
                <Plus size={17} />
                <span className="hidden sm:inline">Crear</span>
              </summary>
              <div className="menu-panel">
                <p className="px-3 py-2 text-xs font-semibold text-neutral-500">
                  Agregar a tu espacio
                </p>
                {admin ? (
                  <>
                    <Link href="/dashboard/projects/new" className="menu-item">
                      <FolderKanban size={16} />
                      Proyecto
                    </Link>
                    <Link href="/dashboard/finance/new" className="menu-item">
                      <Wallet size={16} />
                      Movimiento financiero
                    </Link>
                    <Link href="/dashboard/employees/new" className="menu-item">
                      <Users size={16} />
                      Empleado
                    </Link>
                  </>
                ) : (
                  <Link href="/dashboard/workforce" className="menu-item">
                    <ListTodo size={16} />
                    Registrar trabajo
                  </Link>
                )}
              </div>
            </details>
          </>
        )}
        {isDemoMode() && (
          <span
            title="Modo Demostración / Offline"
            className="hidden rounded-md border border-white/20 px-1.5 py-0.5 text-[10px] font-medium text-white/65 sm:block"
          >
            Demo
          </span>
        )}
        <details className="relative shrink-0">
          <summary aria-label="Notificaciones" className="nav-icon-button">
            <Bell size={19} />
          </summary>
          <div className="menu-panel">
            <p className="px-3 py-2 font-semibold">Notificaciones</p>
            <p className="px-3 pb-3 text-xs leading-5 text-neutral-500">
              Consulta las tareas por revisar y los resultados del equipo en el
              tablero.
            </p>
            <Link
              href="/dashboard/workforce"
              className="menu-item text-emerald-700"
            >
              <ListTodo size={16} />
              Abrir trabajo de hoy
            </Link>
          </div>
        </details>
        <details className="relative shrink-0">
          <summary
            aria-label="Menú de usuario"
            className="flex size-9 items-center justify-center rounded-full border-2 border-white/25 bg-emerald-100 text-xs font-semibold text-emerald-900"
          >
            {initials}
          </summary>
          <div className="menu-panel">
            <div className="border-b border-neutral-100 px-3 py-3">
              <p className="truncate font-semibold">{name}</p>
              <p className="mt-1 truncate text-xs text-neutral-500">
                {user.email}
              </p>
              <p className="mt-2 text-xs text-emerald-700">{user.role_label}</p>
              {isDemoMode() && (
                <p className="mt-2 text-xs leading-5 text-neutral-500">
                  Modo Demostración / Offline. Datos ficticios guardados en este
                  navegador.
                </p>
              )}
            </div>
            <Link href="/dashboard/settings" className="menu-item">
              <Settings2 size={16} />
              Configuración
            </Link>
            {isDemoMode() && (
              <button type="button" className="menu-item" onClick={resetDemo}>
                <RotateCcw size={16} />
                Restablecer demo
              </button>
            )}
            <button
              type="button"
              disabled={closing}
              onClick={() => void signOut()}
              className="menu-item text-red-700"
            >
              <LogOut size={16} />
              {closing ? "Cerrando…" : "Cerrar sesión"}
            </button>
          </div>
        </details>
      </header>
      {mobileOpen && (
        <button
          type="button"
          aria-label="Cerrar menú lateral"
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 top-14 z-20 bg-neutral-950/35 backdrop-blur-[2px] lg:hidden"
        />
      )}
      <aside
        id="dashboard-sidebar"
        aria-label="Barra lateral"
        className={`${mobileOpen ? "visible translate-x-0" : "invisible -translate-x-full"} fixed bottom-0 left-0 top-14 z-30 flex w-60 flex-col border-r border-neutral-200 bg-white transition-transform duration-200 lg:visible lg:translate-x-0`}
      >
        <div className="flex items-center gap-3 border-b border-neutral-100 px-5 py-5">
          <div className="grid size-10 place-items-center rounded-xl bg-emerald-50 text-emerald-700">
            <Sprout size={23} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-neutral-900">
              Finca principal
            </p>
            <p className="mt-0.5 text-xs text-neutral-500">
              Espacio de trabajo
            </p>
          </div>
        </div>
        <nav
          aria-label="Navegación del dashboard"
          className="flex-1 space-y-5 overflow-y-auto px-3 py-5"
        >
          {visibleGroups
            .filter((group) => group.links.length)
            .map((group) => (
              <section key={group.title}>
                <h2 className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-widest text-neutral-500">
                  {group.title}
                </h2>
                <div className="space-y-1">
                  {group.links.map(({ href, label, icon: Icon }) => {
                    const active =
                      href === "/dashboard"
                        ? pathname === href
                        : pathname.startsWith(href);
                    return (
                      <Link
                        key={href}
                        href={href}
                        onClick={navigate}
                        aria-current={active ? "page" : undefined}
                        className={`flex min-h-10 items-center gap-3 rounded-lg px-3 text-[13px] font-medium transition ${active ? "bg-emerald-50 text-emerald-800 ring-1 ring-inset ring-emerald-100" : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"}`}
                      >
                        <Icon size={17} strokeWidth={active ? 2.2 : 1.8} />
                        {label}
                        {active && (
                          <span className="ml-auto size-1.5 rounded-full bg-emerald-600" />
                        )}
                      </Link>
                    );
                  })}
                </div>
              </section>
            ))}
        </nav>
        <div className="border-t border-neutral-100 p-3">
          <Link
            href="/dashboard/settings"
            onClick={navigate}
            className="menu-item text-neutral-500"
          >
            <CircleHelp size={17} />
            Mi cuenta y ayuda
            <ArrowUpRight size={14} className="ml-auto" />
          </Link>
        </div>
      </aside>
      <dialog
        ref={dialog}
        onCancel={() => setSearchOpen(false)}
        onClose={() => setSearchOpen(false)}
        onClick={(event) => {
          if (event.target === event.currentTarget) setSearchOpen(false);
        }}
        aria-labelledby="global-search-title"
        className="fixed inset-0 m-auto max-h-[80svh] w-[calc(100%-2rem)] max-w-xl overflow-hidden rounded-2xl border border-neutral-200 bg-white p-0 shadow-2xl backdrop:bg-neutral-950/40"
      >
        <div className="flex items-center gap-3 border-b border-neutral-100 px-5 py-4">
          <Search size={20} className="text-emerald-700" />
          <label
            id="global-search-title"
            htmlFor="global-search"
            className="sr-only"
          >
            Buscar en la finca
          </label>
          <input
            id="global-search"
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar páginas, proyectos o personal..."
            className="min-w-0 flex-1 bg-transparent py-1 text-sm outline-none"
          />
          <button
            type="button"
            aria-label="Cerrar búsqueda"
            onClick={() => setSearchOpen(false)}
            className="rounded p-1 text-neutral-500"
          >
            <X size={18} />
          </button>
        </div>
        <div className="max-h-[55svh] overflow-y-auto p-2">
          {results.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={navigate}
              className="menu-item justify-between"
            >
              <span className="truncate">{item.label}</span>
              <span className="ml-3 shrink-0 text-xs text-neutral-400">
                {item.context}
              </span>
            </Link>
          ))}
          {!results.length && (
            <p className="p-6 text-center text-sm text-neutral-500">
              Sin resultados. Prueba con otro nombre.
            </p>
          )}
          {searchError && (
            <p role="status" className="px-3 py-2 text-xs text-neutral-500">
              No se pudieron consultar los registros. Puedes navegar a los
              módulos.
            </p>
          )}
        </div>
        <p className="border-t border-neutral-100 px-5 py-3 text-xs text-neutral-400">
          Esc para cerrar · Tab para recorrer los resultados
        </p>
      </dialog>
    </>
  );
}
