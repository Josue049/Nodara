"use client";

import { useEffect, useState } from "react";
import { call } from "./database/api";
import { Modal } from "./modal";

type Analytics = {
  totalViews: number;
  uniqueViewers: number;
  viewsToday: number;
  daily: { day: string; views: number }[];
  viewers: { name: string; email: string; views: number; lastViewedAt: string }[];
};

const fmt = new Intl.DateTimeFormat("es-ES", { dateStyle: "medium", timeStyle: "short" });
const dayFmt = new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short", timeZone: "UTC" });

/** Analíticas de una página: visitas totales, personas únicas, últimos 14 días y quién la ha visto. */
export function AnalyticsPanel({ pageId, onClose }: { pageId: string; onClose: () => void }) {
  const [data, setData] = useState<Analytics | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let alive = true;
    call<Analytics>(`/api/pages/${pageId}/analytics`).then((d) => alive && setData(d)).catch((e) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [pageId]);
  const max = Math.max(1, ...(data?.daily.map((d) => d.views) ?? [1]));
  return (
    <Modal label="Analíticas de la página" testId="analytics-panel" onClose={onClose} width={520}>
      <h2 className="mb-3 text-[18px] font-semibold">Analíticas de la página</h2>
      {error && (
        <p role="alert" className="text-danger">
          {error}
        </p>
      )}
      {!data && !error && <p className="text-ink-3">Cargando…</p>}
      {data && (
        <>
          <dl className="mb-4 grid grid-cols-3 gap-2 text-center">
            {[
              ["Visitas", data.totalViews, "stat-total"],
              ["Personas", data.uniqueViewers, "stat-unique"],
              ["Hoy", data.viewsToday, "stat-today"],
            ].map(([label, value, id]) => (
              <div key={String(id)} className="rounded-lg border border-line p-3">
                <dd className="text-[24px] font-semibold" data-testid={String(id)}>
                  {value}
                </dd>
                <dt className="text-[13px] text-ink-3">{label}</dt>
              </div>
            ))}
          </dl>
          <figure aria-label="Visitas de los últimos 14 días" className="mb-4">
            <div className="flex h-24 items-end gap-1" role="img" aria-label={`Visitas por día: ${data.daily.map((d) => `${dayFmt.format(new Date(d.day))} ${d.views}`).join(", ")}`}>
              {data.daily.map((d) => (
                <div key={d.day} title={`${dayFmt.format(new Date(d.day))}: ${d.views}`} className="flex-1 rounded-t bg-accent/70" style={{ height: `${Math.max(d.views ? 6 : 2, (d.views / max) * 100)}%`, opacity: d.views ? 1 : 0.25 }} />
              ))}
            </div>
            <figcaption className="mt-1 flex justify-between text-[12px] text-ink-3">
              <span>{dayFmt.format(new Date(data.daily[0].day))}</span>
              <span>{dayFmt.format(new Date(data.daily.at(-1)!.day))}</span>
            </figcaption>
          </figure>
          <h3 className="mb-1 font-medium">Vista recientemente por</h3>
          <ul className="flex flex-col gap-1" data-testid="viewers">
            {data.viewers.map((v) => (
              <li key={v.email} className="flex items-center justify-between rounded-md px-2 py-1 hover:bg-hover">
                <span className="truncate">{v.name}</span>
                <span className="shrink-0 text-[13px] text-ink-3">
                  {v.views} {v.views === 1 ? "visita" : "visitas"} · {fmt.format(new Date(v.lastViewedAt))}
                </span>
              </li>
            ))}
            {data.viewers.length === 0 && <li className="text-ink-3">Aún nadie ha visto esta página.</li>}
          </ul>
        </>
      )}
    </Modal>
  );
}
