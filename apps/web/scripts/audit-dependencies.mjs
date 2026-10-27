import path from "node:path";
import { spawnSync } from "node:child_process";

function audit(extra = []) {
  const windows = process.platform === "win32";
  const npmCli = path.join(path.dirname(process.execPath), "node_modules/npm/bin/npm-cli.js");
  const result = spawnSync(windows ? process.execPath : "npm", [...(windows ? [npmCli] : []), "audit", "--json", ...extra], {
    encoding: "utf8", maxBuffer: 10 * 1024 * 1024,
  });
  if (result.error || ![0, 1].includes(result.status)) throw new Error("No se pudo consultar la auditoría.");
  const report = JSON.parse(result.stdout);
  if (report.error || !report.metadata || !report.vulnerabilities) throw new Error("Auditoría incompleta.");
  return report;
}
if (audit(["--omit=dev"]).metadata.vulnerabilities.total !== 0) {
  throw new Error("Hallazgos en dependencias de producción: detener release.");
}
const full = audit();
if (full.metadata.vulnerabilities.total !== 0) {
  throw new Error("Hallazgos en desarrollo: detener release y revisar dependencias.");
}
console.log("Auditoria completa y de produccion: cero vulnerabilidades; sin excepciones activas.");
