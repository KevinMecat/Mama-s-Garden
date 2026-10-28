import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { chromium } from "@playwright/test";

// Exercise the actual exported worker and its chunks, rather than transpiling its source in a test.
const output = path.resolve("out");
const chunks = path.join(output, "_next", "static");
function findWorkers(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) return findWorkers(file);
    if (!entry.name.endsWith(".js")) return [];
    const content = fs.readFileSync(file, "utf8");
    return content.includes("onmessage") && content.includes("No se pudo calcular la propuesta.") ? [file] : [];
  });
}
const candidates = findWorkers(chunks);
assert.equal(candidates.length, 1, `Expected one compiled planner worker, found ${candidates.length}`);
const workerUrl = "/" + path.relative(output, candidates[0]).split(path.sep).join("/");
const server = http.createServer((request, response) => {
  if (request.url === "/") {
    response.writeHead(200, { "Content-Type": "text/html", "Content-Security-Policy": "default-src 'self'" });
    response.end("<!doctype html><title>Worker test</title>");
    return;
  }
  const relative = decodeURIComponent(new URL(request.url, "http://localhost").pathname).replace(/^\/+/, "");
  const file = path.resolve(output, relative);
  if (!file.startsWith(output + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    response.writeHead(404).end();
    return;
  }
  response.writeHead(200, { "Content-Type": file.endsWith(".js") ? "text/javascript" : "application/octet-stream" });
  fs.createReadStream(file).pipe(response);
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
let browser;
try {
  browser = await chromium.launch(process.env.QA_BROWSER_CHANNEL ? { channel: process.env.QA_BROWSER_CHANNEL } : {});
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  const result = await page.evaluate((url) => new Promise((resolve, reject) => {
    const worker = new Worker(url);
    const timeout = setTimeout(() => { worker.terminate(); reject(new Error("Worker did not respond")); }, 15000);
    worker.onerror = (event) => { clearTimeout(timeout); worker.terminate(); reject(new Error(event.message)); };
    worker.onmessage = (event) => { clearTimeout(timeout); worker.terminate(); resolve(event.data); };
    worker.postMessage({
      workers: [{ id: "w1", present: true, availableHours: 1, skills: { riego: "independent" } }],
      tasks: [{ id: "t1", activity: "riego", hours: 1, priority: 1 }],
      slots: 2,
    });
  }), workerUrl);
  assert.equal(result.result?.feasible, true, JSON.stringify(result));
  assert.equal(result.result.assignments.length, 2);
  console.log("PASS exported planner worker executed a real solve in a browser under the hosting CSP.");
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}
