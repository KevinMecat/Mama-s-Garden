import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const manifest = JSON.parse(fs.readFileSync("package.json", "utf8"));
const forbidden = new Set([
  ...Object.keys(manifest.devDependencies ?? {}),
  "@next/eslint-plugin-next", "eslint-config-next", "fast-glob", "micromatch", "braces",
]);
const mode = process.argv[2];
let maps = 0;
let traces = 0;
function checkName(name) {
  if (forbidden.has(name)) throw new Error(`Dependencia de desarrollo en artefacto: ${name}`);
}
function checkSource(source) {
  const normalized = source.replaceAll("\\", "/");
  for (const name of forbidden) {
    if (normalized.includes(`/node_modules/${name}/`)) checkName(name);
  }
}
function walk(directory, inspect) {
  if (!fs.existsSync(directory)) throw new Error(`Falta artefacto: ${directory}`);
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) walk(full, inspect);
    else inspect(full);
  }
}
if (mode === "dependencies" || mode === "runtime") {
  walk(path.join(root, "node_modules"), (file) => {
    if (path.basename(file) === "package.json") {
      const item = JSON.parse(fs.readFileSync(file, "utf8"));
      if (item.name) checkName(item.name);
    }
  });
}
if (mode === "build" || mode === "runtime") {
  walk(path.join(root, ".next"), (file) => {
    checkSource(file);
    if (file.endsWith(".js.map")) {
      if (mode === "runtime") throw new Error("Source map público en imagen final.");
      const map = JSON.parse(fs.readFileSync(file, "utf8"));
      const visit = (item) => {
        for (const source of item.sources ?? []) checkSource(source);
        for (const section of item.sections ?? []) visit(section.map);
      };
      visit(map);
      maps++;
    }
    if (file.endsWith(".nft.json")) {
      const trace = JSON.parse(fs.readFileSync(file, "utf8"));
      for (const source of trace.files ?? []) checkSource(`/${source}`);
      traces++;
    }
  });
  if (mode === "build" && (!maps || !traces)) throw new Error("Faltan mapas/trazas para demostrar aislamiento.");
}
if (!["build", "runtime", "dependencies"].includes(mode)) throw new Error("Modo de auditoría inválido.");
console.log(`Aislamiento ${mode}: correcto; mapas=${maps}, trazas=${traces}.`);
