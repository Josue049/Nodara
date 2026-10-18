// Servidor con protocolo PostgreSQL (PGlite) en un proceso aparte, para pruebas de integración. Uso: node pg-server.mjs <puerto>
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
const server = new PGLiteSocketServer({ db: await PGlite.create(), port: Number(process.argv[2]), host: "127.0.0.1", maxConnections: 10 });
await server.start();
console.log("ready");
process.on("SIGTERM", async () => { await server.stop(); process.exit(0); });
setInterval(() => {}, 1 << 30);
