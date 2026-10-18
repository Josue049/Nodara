// Arranca Next en modo dev con una base PGlite desechable para las pruebas E2E.
import { spawn } from "node:child_process";
import { rmSync } from "node:fs";
import path from "node:path";

const port = process.argv[2] ?? "3100";
const dataDir = path.resolve(process.cwd(), "..", ".data", "e2e");
rmSync(dataDir, { recursive: true, force: true });

const child = spawn(
  process.execPath,
  [path.join("node_modules", "next", "dist", "bin", "next"), "dev", "-p", port, "-H", "127.0.0.1"],
  { stdio: "inherit", env: { ...process.env, DATABASE_URL: "", NODARA_DATA_DIR: dataDir, NODARA_E2E: "1" } },
);
child.on("exit", (code) => process.exit(code ?? 0));
process.on("SIGTERM", () => child.kill());
