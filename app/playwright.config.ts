import { defineConfig } from "@playwright/test";

const PORT = 3100;

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 30_000,
  workers: 1,
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    channel: "chrome", // Chrome del sistema: no requiere descargar navegadores
    viewport: { width: 1440, height: 900 },
    trace: "retain-on-failure",
  },
  webServer: {
    command: `node scripts/e2e-server.mjs ${PORT}`,
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
