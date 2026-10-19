import { randomUUID } from "node:crypto";
import { defineConfig } from "@playwright/test";

const PORT = 3100;
// Token aleatorio por ejecución: lo comparten el servidor de pruebas y los tests; protege /api/test/reset.
process.env.NODARA_E2E_TOKEN ??= randomUUID();

export default defineConfig({
  testDir: "tests/e2e",
  // Fuera de app/ para no ensuciar el árbol del proyecto.
  outputDir: "../.data/pw-results",
  timeout: 30_000,
  workers: 1,
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    channel: "chrome", // Chrome del sistema: no requiere descargar navegadores
    viewport: { width: 1440, height: 900 },
    trace: "retain-on-failure",
    extraHTTPHeaders: { "x-nodara-e2e-token": process.env.NODARA_E2E_TOKEN },
  },
  webServer: {
    command: `node scripts/e2e-server.mjs ${PORT}`,
    url: `http://127.0.0.1:${PORT}/api/pages`,
    reuseExistingServer: false,
    timeout: 300_000, // incluye el build
    env: { NODARA_E2E_TOKEN: process.env.NODARA_E2E_TOKEN },
  },
});
