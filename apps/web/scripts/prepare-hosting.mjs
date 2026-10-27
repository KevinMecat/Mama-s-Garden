import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";

// Run from apps/web after an audited build. Only out/ is deployable.
const root = path.resolve("../..");
const out = path.resolve("out");
const provenance = JSON.parse(fs.readFileSync(path.join(out, "build-info.json"), "utf8"));
if (provenance.dirty || provenance.dataSource === "demo" || execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim() || provenance.sha !== execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim()) throw new Error("Only an unchanged clean production build can be published.");
const hashes = new Set();
let pages = 0;
function visit(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isSymbolicLink()) throw new Error("Symlink in public export");
    if (entry.isDirectory()) { visit(file); continue; }
    if (entry.name.endsWith(".map")) { fs.unlinkSync(file); continue; }
    if (/^\.env|\.(pem|key|db|sqlite3)$|package-lock\.json/.test(entry.name)) throw new Error("Forbidden public artifact");
    if (/\.(js|html)$/.test(entry.name) && /demo@mamasgarden\.com|demo1234|finca\.demo\.v1|Modo Demostración|demo-workforce-browser/.test(fs.readFileSync(file, "utf8"))) throw new Error("Synthetic fixture or mock UI in public export");
    if (file.endsWith(".html")) {
      pages++;
      const html = fs.readFileSync(file, "utf8");
      for (const script of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
        if (!/\bsrc\s*=/.test(script[1]) && script[2]) hashes.add(`'sha256-${createHash("sha256").update(script[2]).digest("base64")}'`);
      }
    }
  }
}
visit(out);
if (pages < 20 || !hashes.size) throw new Error("Incomplete static export");
const api = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/$/, "");
if (api) {
  const url = new URL(api);
  if (url.protocol !== "https:" || url.origin !== api) throw new Error("NEXT_PUBLIC_API_URL must be an HTTPS origin");
}
const firebase = (process.env.NEXT_PUBLIC_DATA_SOURCE ?? (api ? "django" : "firebase")) === "firebase";
const cloudConnections = firebase ? " https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://firestore.googleapis.com https://firebasestorage.googleapis.com" : "";
const cloudImages = firebase ? " https://firebasestorage.googleapis.com https://storage.googleapis.com" : "";
const csp = [
  "default-src 'self'", `script-src 'self' ${[...hashes].join(" ")}`,
  "style-src 'self' 'unsafe-inline'", "img-src 'self' data: https://images.unsplash.com" + cloudImages + (api ? ` ${api}` : ""),
  "font-src 'self'", `connect-src 'self'${cloudConnections}${api ? ` ${api}` : ""}`,
  "object-src 'none'", "base-uri 'self'", "frame-ancestors 'none'", "form-action 'self'", "upgrade-insecure-requests",
].join("; ");
const configPath = path.join(root, "firebase.json");
const config = fs.existsSync(configPath) ? JSON.parse(fs.readFileSync(configPath, "utf8")) : { hosting: {} };
config.hosting.cleanUrls = true;
config.hosting.headers = [
  { source: "**", headers: [
    { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains; preload" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "Content-Security-Policy", value: csp },
  ] },
  { source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }] },
  { source: "/build-info.json", headers: [{ key: "Cache-Control", value: "no-store" }] },
  { source: "/_next/static/**", headers: [{ key: "Cache-Control", value: "public,max-age=31536000,immutable" }] },
];
if (fs.existsSync(configPath)) fs.writeFileSync(path.join(root, "firebase.deploy.json"), JSON.stringify(config, null, 2) + "\n");
fs.writeFileSync("hosting-csp.conf", `add_header Content-Security-Policy "${csp}" always;\n`);
console.log(`Static Hosting prepared: ${pages} pages; ${hashes.size} inline-script hashes; API ${api ? "configured" : "disabled"}.`);
