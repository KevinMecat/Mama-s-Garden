import fs from "node:fs";
import { execFileSync } from "node:child_process";
const sha = execFileSync("git", ["rev-parse", "HEAD"], {
  encoding: "utf8",
}).trim();
const dirty =
  execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim()
    .length > 0;
const { version } = JSON.parse(fs.readFileSync("package.json", "utf8"));
if (process.env.NEXT_PUBLIC_DATA_SOURCE === "demo") throw Error("Mock sessions cannot be published.");
if (process.env.NEXT_PUBLIC_FIREBASE_EMULATORS === "1")
  throw Error("Emulator builds cannot be published.");
fs.mkdirSync("public", { recursive: true });
fs.writeFileSync(
  "public/build-info.json",
  JSON.stringify({
    version,
    sha,
    dirty,
    builtAt: new Date().toISOString(),
    dataSource:
      process.env.NEXT_PUBLIC_DATA_SOURCE ||
      (process.env.NEXT_PUBLIC_API_URL ? "django" : "firebase"),
  }) + "\n",
);
console.log(
  `Build provenance: ${version} ${sha.slice(0, 12)}${dirty ? " (uncommitted changes)" : ""}`,
);
