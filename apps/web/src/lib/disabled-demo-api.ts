// Production builds exclude all synthetic fixtures and local mock sessions.
export async function demoFetch(): Promise<Response> {
  throw new Error("El proveedor de pruebas no está disponible en producción.");
}
