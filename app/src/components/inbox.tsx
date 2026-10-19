"use client";

import { AtSign, Bell, MessageSquare, Reply } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { call } from "./database/api";
import { anchorOf, Popover, type Anchor } from "./database/popover";
import { PageIcon } from "./page-icon";

type Item = { id: string; type: string; preview: string; createdAt: string; read: boolean; pageId: string; pageTitle: string; pageIcon: string | null; actorName: string | null };
type Data = { unread: number; items: Item[] };

const VERB: Record<string, string> = { mention: "te mencionó", comment: "comentó en", reply: "respondió en" };
const ICON = { mention: AtSign, comment: MessageSquare, reply: Reply } as const;
const fmt = new Intl.DateTimeFormat("es-ES", { dateStyle: "medium", timeStyle: "short" });

/** Bandeja de entrada: menciones, comentarios y respuestas, con contador de no leídas (consulta cada 8 s). */
export function Inbox({ rowClass }: { rowClass: string }) {
  const router = useRouter();
  const [data, setData] = useState<Data>({ unread: 0, items: [] });
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const btn = useRef<HTMLButtonElement>(null);

  const load = useCallback(async () => setData(await call<Data>("/api/notifications")), []);
  useEffect(() => {
    let alive = true;
    const tick = () => call<Data>("/api/notifications").then((d) => alive && setData(d)).catch(() => {});
    void tick();
    const id = setInterval(tick, 8000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  return (
    <>
      <button ref={btn} type="button" data-testid="inbox-btn" onClick={() => btn.current && (void load(), setAnchor(anchorOf(btn.current)))} className={`${rowClass} w-full pl-[8px] font-normal`}>
        <Bell size={16} className="mr-1.5" />
        Bandeja de entrada
        {data.unread > 0 && (
          <span data-testid="inbox-badge" className="ml-auto rounded-full bg-accent px-1.5 text-[11px] font-medium leading-[18px] text-white">
            {data.unread}
          </span>
        )}
      </button>
      {anchor && (
        <Popover anchor={anchor} onClose={() => setAnchor(null)} label="Bandeja de entrada" testId="inbox-popover" width={380}>
          <div className="flex items-center justify-between px-2 py-1.5">
            <p className="font-medium">Bandeja de entrada</p>
            {data.unread > 0 && (
              <button
                type="button"
                data-testid="mark-all-read"
                onClick={async () => {
                  await call("/api/notifications", "PATCH", {});
                  await load();
                }}
                className="rounded px-1.5 text-[13px] text-accent hover:bg-hover"
              >
                Marcar todo como leído
              </button>
            )}
          </div>
          <ul className="max-h-[420px] overflow-y-auto">
            {data.items.length === 0 && (
              <li className="px-3 py-8 text-center text-ink-3" data-testid="inbox-empty">
                Estás al día. Aquí verás menciones y comentarios.
              </li>
            )}
            {data.items.map((n) => {
              const Icon = ICON[n.type as keyof typeof ICON] ?? MessageSquare;
              return (
                <li key={n.id}>
                  <button
                    type="button"
                    data-testid="inbox-item"
                    data-unread={!n.read}
                    onClick={async () => {
                      setAnchor(null);
                      await call("/api/notifications", "PATCH", { ids: [n.id] });
                      await load();
                      router.push(`/${n.pageId}`);
                    }}
                    className={`flex w-full items-start gap-2 rounded-md px-2 py-2 text-left hover:bg-hover ${n.read ? "" : "bg-accent/5"}`}
                  >
                    <span className="mt-0.5 text-ink-2">
                      <Icon size={16} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[14px]">
                        <span className="font-medium">{n.actorName ?? "Alguien"}</span> {VERB[n.type] ?? "interactuó con"}{" "}
                        <span className="inline-flex items-center gap-1 font-medium">
                          <PageIcon icon={n.pageIcon} size={13} />
                          {n.pageTitle || "Sin título"}
                        </span>
                      </span>
                      {n.preview && <span className="block truncate text-[13px] text-ink-2">{n.preview}</span>}
                      <span className="block text-[12px] text-ink-3">{fmt.format(new Date(n.createdAt))}</span>
                    </span>
                    {!n.read && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-accent" aria-label="No leída" />}
                  </button>
                </li>
              );
            })}
          </ul>
        </Popover>
      )}
    </>
  );
}
