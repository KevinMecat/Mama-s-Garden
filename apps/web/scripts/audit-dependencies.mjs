import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const risk = JSON.parse(fs.readFileSync("security/dev-risk.json", "utf8"));
if (Date.now() >= Date.parse(risk.expires)) throw new Error("Excepción de desarrollo caducada.");
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
for (const [name, item] of Object.entries(full.vulnerabilities)) {
  if (!risk.packages.includes(name)) throw new Error(`Hallazgo fuera del riesgo documentado: ${name}`);
  for (const via of item.via) {
    if (typeof via === "string" ? !risk.packages.includes(via) : via.url !== risk.advisory) {
      throw new Error("Advisory nuevo: renovar revisión de riesgo antes de continuar.");
    }
  }
}
console.log(`Producción sin hallazgos; desarrollo limitado a la cadena documentada (${Object.keys(full.vulnerabilities).length} entradas). Aprobación humana: ${risk.businessApproval}.`);
