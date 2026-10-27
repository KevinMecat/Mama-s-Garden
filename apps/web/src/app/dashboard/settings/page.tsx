"use client";
import { ShieldCheck, Monitor } from "lucide-react";
import { ClientPage } from "@/components/client-page";
import { requireUser } from "@/lib/page-api";
async function loadPage() {
  const user = await requireUser();
  return (
    <section className="mx-auto max-w-4xl px-4 py-7 sm:px-7 lg:px-8">
      <p className="eyebrow">Preferencias / Mi cuenta</p>
      <h1 className="page-title mt-2">Configuración</h1>
      <p className="mt-2 text-sm text-neutral-500">
        Tu perfil y el entorno de este espacio de trabajo.
      </p>
      <article className="surface-card mt-7 p-6">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <ShieldCheck size={19} className="text-emerald-700" />
          Cuenta y acceso
        </h2>
        <dl className="mt-5 grid gap-5 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-neutral-500">Nombre</dt>
            <dd className="mt-1 font-medium">
              {user.first_name} {user.last_name}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-neutral-500">Correo</dt>
            <dd className="mt-1 break-all font-medium">{user.email}</dd>
          </div>
          <div>
            <dt className="text-xs text-neutral-500">Rol</dt>
            <dd className="mt-1 font-medium">{user.role_label}</dd>
          </div>
          <div>
            <dt className="text-xs text-neutral-500">Espacio de trabajo</dt>
            <dd className="mt-1 font-medium">Finca Mama&apos;s Garden</dd>
          </div>
        </dl>
        <p className="mt-5 border-t border-neutral-100 pt-4 text-xs leading-5 text-neutral-500">
          Para modificar permisos o datos de tu cuenta, contacta al
          administrador de la finca.
        </p>
      </article>
      <article className="surface-card mt-5 p-6">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <Monitor size={19} className="text-emerald-700" />
          Entorno de la aplicación
        </h2>
        <p className="mt-4 text-sm text-neutral-600">
          Sesión privada vinculada al servicio de datos de la finca.
        </p>
      </article>
    </section>
  );
}
export default function Page() {
  return <ClientPage load={loadPage} />;
}
