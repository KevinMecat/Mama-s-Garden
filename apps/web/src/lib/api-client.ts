import { demoFetch } from "@/lib/demo-api";

const origin = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/$/, "");
export const dataSource =
  process.env.NEXT_PUBLIC_DATA_SOURCE ?? (origin ? "django" : "firebase");
if (!["firebase", "django", "demo"].includes(dataSource))
  throw new Error("Origen de datos no válido.");
export const isApiConfigured = () => dataSource === "django" && Boolean(origin);
export const isDemoMode = () => dataSource === "demo";
export const isFirebaseMode = () => dataSource === "firebase";
export const DATA_CHANGED_EVENT = "finca:data-changed";

export function apiUrl(path: string) {
  if (
    (!path.startsWith("/api/") && !path.startsWith("/media/")) ||
    path.includes("\\")
  ) {
    throw new Error("Ruta de API no permitida.");
  }
  if (origin) {
    const parsed = new URL(origin);
    if (
      parsed.origin !== origin ||
      parsed.username ||
      parsed.password ||
      (process.env.NODE_ENV === "production" && parsed.protocol !== "https:")
    ) {
      throw new Error("El servicio de datos requiere un origen HTTPS valido.");
    }
  }
  return `${origin}${path}`;
}

export async function apiFetch(path: string, options: RequestInit = {}) {
  const url = apiUrl(path);
  if (isFirebaseMode())
    return new Response(
      JSON.stringify({
        detail:
          "La conexión Firebase es de solo lectura y no utiliza la API de Django.",
      }),
      { status: 405, headers: { "Content-Type": "application/json" } },
    );
  if (dataSource === "django" && !origin)
    throw new Error("Falta el origen de Django.");
  const response = isDemoMode()
    ? await demoFetch(path, options)
    : await fetch(url, {
        ...options,
        credentials: "include",
        cache: "no-store",
      });
  if (response.ok && options.method && options.method !== "GET") {
    window.dispatchEvent(new Event(DATA_CHANGED_EVENT));
  }
  return response;
}
