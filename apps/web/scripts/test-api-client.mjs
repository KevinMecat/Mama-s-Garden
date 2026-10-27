import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const code = ts.transpileModule(fs.readFileSync("src/lib/api-client.ts", "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
function client(origin) {
  const calls = [];
  const events = [];
  const context = {
    exports: {}, URL, Event,
    process: { env: { NODE_ENV: "production", NEXT_PUBLIC_API_URL: origin } },
    window: { dispatchEvent: event => events.push(event.type) },
    fetch: async (url, options) => { calls.push({ url, options }); return { ok: true }; },
  };
  vm.runInNewContext(code, context);
  return { api: context.exports, calls, events };
}
const absent = client("");
await assert.rejects(absent.api.apiFetch("/api/v1/auth/login/", { method: "POST" }));
assert.equal(absent.calls.length, 0, "No credentials may leave the browser without an API origin");
for (const origin of ["http://api.example.com", "https://user:pass@api.example.com", "https://api.example.com/path", "https://api.example.com?x=1", "https://api.example.com#x"]) {
  assert.throws(() => client(origin).api.apiUrl("/api/v1/auth/me/"));
}
const configured = client("https://api.example.com/");
for (const route of ["https://attacker.example/api/", "//attacker.example/api/", "/api/\\attacker"]) {
  assert.throws(() => configured.api.apiUrl(route));
}
await configured.api.apiFetch("/api/v1/auth/login/", { method: "POST", credentials: "omit", cache: "force-cache" });
assert.equal(configured.calls[0].url, "https://api.example.com/api/v1/auth/login/");
assert.equal(configured.calls[0].options.credentials, "include");
assert.equal(configured.calls[0].options.cache, "no-store");
assert.equal(configured.events[0], "finca:data-changed");
console.log("API client security: disabled-by-default, HTTPS origin, credentials and cache checks passed.");
