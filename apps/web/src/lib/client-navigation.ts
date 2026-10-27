export class ClientNavigation extends Error {
  constructor(public readonly destination: string) {
    super("Cambio de ruta requerido.");
  }
}

export function redirect(destination: string): never {
  throw new ClientNavigation(destination);
}
