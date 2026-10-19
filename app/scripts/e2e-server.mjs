// Servidor para las pruebas E2E: build de producción en un directorio aparte + base PGlite desechable.
import { spawn, spawnSync } from "node:child_process";
import { rmSync } from "node:fs";
import path from "node:path";

const port = process.argv[2] ?? "3100";
const root = path.resolve(process.cwd(), "..", ".data");
const dataDir = path.join(root, "e2e");
const uploadDir = path.join(root, "e2e-uploads");
rmSync(dataDir, { recursive: true, force: true });
rmSync(uploadDir, { recursive: true, force: true });

const env = {
  ...process.env,
  DATABASE_URL: "", // nunca contra PostgreSQL
  NODARA_DATA_DIR: dataDir,
  NODARA_UPLOAD_DIR: uploadDir,
  NODARA_E2E: "1",
  NODARA_VERSION_INTERVAL_MS: "0", // una versión por guardado (determinista)
  NODARA_DIST_DIR: ".next-e2e",
};
const next = [path.join("node_modules", "next", "dist", "bin", "next")];

const build = spawnSync(process.execPath, [...next, "build"], { stdio: "inherit", env });
if (build.status !== 0) process.exit(build.status ?? 1);

const child = spawn(process.execPath, [...next, "start", "-p", port, "-H", "127.0.0.1"], { stdio: "inherit", env });
child.on("exit", (code) => process.exit(code ?? 0));
process.on("SIGTERM", () => child.kill());
