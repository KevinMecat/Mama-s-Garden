import { solvePrototype } from "../lib/planner-prototype.mjs";

self.onmessage = (event: MessageEvent) => {
  try { self.postMessage({ result: solvePrototype(event.data) }); }
  catch (error) { self.postMessage({ error: error instanceof Error ? error.message : "No se pudo calcular la propuesta." }); }
};
