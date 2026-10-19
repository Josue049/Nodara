import { z } from "zod";
import { assertPage } from "@/server/authz";
import { connect } from "@/server/collab-service";
import { api } from "@/server/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Canal Server-Sent Events: sincronización inicial, actualizaciones del documento y presencia. */
export const GET = api(async (req, p, user, db) => {
  const pageId = z.uuid().parse(p.id);
  const url = new URL(req.url);
  const cid = z.string().min(8).max(64).regex(/^[\w-]+$/).parse(url.searchParams.get("cid"));
  const aid = z.coerce.number().int().nonnegative().parse(url.searchParams.get("aid"));
  await assertPage(db, user, pageId, "view");

  const enc = new TextEncoder();
  let closed = false;
  let leave: (() => Promise<void>) | null = null;
  let ping: ReturnType<typeof setInterval> | null = null;
  const close = async () => {
    if (closed) return;
    closed = true;
    if (ping) clearInterval(ping);
    await leave?.();
  };

  const stream = new ReadableStream({
    async start(controller) {
      const raw = (text: string) => {
        if (closed) return;
        try {
          controller.enqueue(enc.encode(text));
        } catch {
          void close();
        }
      };
      raw("retry: 1000\n\n");
      leave = await connect(db, pageId, { id: cid, userId: user.id, awarenessId: aid, send: (event, data) => raw(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`) });
      ping = setInterval(() => raw("event: ping\ndata: 1\n\n"), 15_000);
      req.signal.addEventListener("abort", () => void close());
    },
    cancel() {
      void close();
    },
  });
  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive", "X-Accel-Buffering": "no" },
  });
});
