"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

import { AUTH_CHANGED_EVENT } from "@/components/auth/auth-controls";
import { isDemoMode } from "@/lib/api-client";
import { resetDemo } from "@/lib/demo-api";
import { AuthApiError, login } from "@/lib/auth-api";

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");

    try {
      await login(email, password);
      window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
      router.replace("/dashboard");
      router.refresh();
    } catch (requestError) {
      setError(
        requestError instanceof AuthApiError
          ? requestError.message
          : "No se pudo conectar con el servidor. Intenta nuevamente.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
      <div>
        <label htmlFor="email" className="text-sm font-semibold text-brand-ink">
          Correo electrónico
        </label>
        <input
          id="email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          required
          placeholder="nombre@ejemplo.com"
          className="mt-2 min-h-12 w-full rounded-xl border border-brand-border bg-white px-4 text-base text-brand-ink outline-none transition placeholder:text-brand-muted/65 focus:border-brand-secondary focus:ring-4 focus:ring-brand-sage/30"
        />
      </div>

      <div>
        <div className="flex items-center justify-between gap-4">
          <label htmlFor="password" className="text-sm font-semibold text-brand-ink">
            Contraseña
          </label>
          <button
            type="button"
            onClick={() => setShowPassword((visible) => !visible)}
            className="min-h-11 px-1 text-sm font-semibold text-brand-secondary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
          >
            {showPassword ? "Ocultar" : "Mostrar"}
          </button>
        </div>
        <input
          id="password"
          name="password"
          type={showPassword ? "text" : "password"}
          autoComplete="current-password"
          required
          placeholder="Tu contraseña"
          className="mt-1 min-h-12 w-full rounded-xl border border-brand-border bg-white px-4 text-base text-brand-ink outline-none transition placeholder:text-brand-muted/65 focus:border-brand-secondary focus:ring-4 focus:ring-brand-sage/30"
        />
      </div>

      {error ? (
        <p
          role="alert"
          aria-live="polite"
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-800"
        >
          {error}
        </p>
      ) : null}
      {isDemoMode() && error && <button type="button" onClick={resetDemo} className="text-sm font-semibold underline">Restablecer datos demo locales</button>}

      <button
        type="submit"
        disabled={isSubmitting}
        className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-brand-primary px-5 text-base font-semibold text-white shadow-[0_12px_32px_rgba(72,73,39,0.2)] transition hover:bg-brand-secondary disabled:cursor-wait disabled:opacity-65 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
      >
        {isSubmitting ? "Ingresando…" : "Ingresar"}
      </button>
    </form>
  );
}
