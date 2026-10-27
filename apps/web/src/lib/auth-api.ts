import { apiFetch, isFirebaseMode } from "@/lib/api-client";
import type { AuthResponse, AuthUser } from "@/types/auth";

const AUTH_ROOT = "/api/v1/auth";

interface ApiErrorPayload {
  detail?: string;
  non_field_errors?: string[];
  email?: string[];
  password?: string[];
}

export class AuthApiError extends Error {}

async function getErrorMessage(response: Response) {
  const payload = (await response.json().catch(() => ({}))) as ApiErrorPayload;

  return (
    payload.non_field_errors?.[0] ??
    payload.email?.[0] ??
    payload.password?.[0] ??
    payload.detail ??
    "No fue posible completar la solicitud. Intenta nuevamente."
  );
}

export async function getCsrfToken() {
  const response = await apiFetch(`${AUTH_ROOT}/csrf/`, {
    cache: "no-store",
    credentials: "include",
  });

  if (!response.ok) {
    throw new AuthApiError(await getErrorMessage(response));
  }

  const payload = (await response.json()) as { csrfToken: string };
  return payload.csrfToken;
}

export async function login(
  email: string,
  password: string,
): Promise<AuthUser> {
  if (isFirebaseMode()) {
    try {
      return await (
        await import("@/lib/firebase-client")
      ).firebaseLogin(email, password);
    } catch {
      throw new AuthApiError(
        "No fue posible acceder. Verifica tu correo y contraseña de Firebase, tu perfil activo y la conexión.",
      );
    }
  }
  const csrfToken = await getCsrfToken();
  const response = await apiFetch(`${AUTH_ROOT}/login/`, {
    method: "POST",
    cache: "no-store",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      "X-CSRFToken": csrfToken,
    },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    throw new AuthApiError(await getErrorMessage(response));
  }

  return ((await response.json()) as AuthResponse).user;
}

export async function logout() {
  if (isFirebaseMode()) {
    await (await import("@/lib/firebase-client")).firebaseLogout();
    return;
  }
  const csrfToken = await getCsrfToken();
  const response = await apiFetch(`${AUTH_ROOT}/logout/`, {
    method: "POST",
    cache: "no-store",
    credentials: "include",
    headers: {
      "X-CSRFToken": csrfToken,
    },
  });

  if (!response.ok) {
    throw new AuthApiError(await getErrorMessage(response));
  }
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  if (isFirebaseMode())
    return (await import("@/lib/firebase-client")).firebaseCurrentUser();
  const response = await apiFetch(`${AUTH_ROOT}/me/`, {
    cache: "no-store",
    credentials: "include",
  });

  if (response.status === 401 || response.status === 403) {
    return null;
  }

  if (!response.ok) {
    throw new AuthApiError(await getErrorMessage(response));
  }

  return ((await response.json()) as AuthResponse).user;
}
