"use client";

import { Bookmark } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { CollectionBundle, QueryResult, RecordRow, SelectOption } from "@/lib/collections/types";
import { t } from "@/lib/strings";
import { call, dbApi } from "./api";
import { EditableCell, type CellCtx } from "./cells";
import { PropertyIcon } from "./property-icon";

type Data = { bundle: CollectionBundle; row: RecordRow | null; refs: NonNullable<QueryResult["refs"]>; people: NonNullable<QueryResult["people"]>; members: NonNullable<QueryResult["members"]> };

/** Panel de propiedades de un registro (arriba de su contenido), con edición real de cada valor. */
export function RecordProperties({ pageId }: { pageId: string }) {
  const [data, setData] = useState<Data | null>(null);

  const reload = useCallback(async () => {
    setData(await call<Data>(`/api/records/${pageId}`));
  }, [pageId]);

  useEffect(() => {
    let alive = true;
    call<Data>(`/api/records/${pageId}`).then((d) => alive && setData(d)).catch(() => {});
    return () => {
      alive = false;
    };
  }, [pageId]);

  const ctx: CellCtx = useMemo(
    () => ({
      refs: data?.refs ?? {},
      people: data?.people ?? {},
      members: data?.members ?? [],
      createOption: async (propertyId: string, name: string): Promise<SelectOption> => {
        const { option } = await dbApi.addOption(propertyId, name);
        await reload();
        return option;
      },
    }),
    [data?.refs, data?.people, data?.members, reload],
  );

  if (!data?.row) return null;
  const { row, bundle } = data;

  return (
    <div className="mb-4 flex flex-col gap-0.5 border-b border-line pb-3" data-testid="record-properties" aria-label={t.properties}>
      {bundle.properties.map((p) => (
        <div key={p.id} className="flex min-h-[32px] items-start gap-2" data-testid="record-prop" data-prop={p.name}>
          <div className="flex h-8 w-[160px] shrink-0 items-center gap-1.5 text-[14px]" style={{ color: "var(--db-header)" }}>
            <PropertyIcon type={p.type} />
            <span className="truncate">{p.name}</span>
          </div>
          <div className="min-w-0 flex-1 rounded px-1.5 py-1 hover:bg-hover">
            <EditableCell
              prop={p}
              value={row.values[p.id]}
              ctx={ctx}
              onChange={async (v) => {
                await dbApi.updateRecord(pageId, { properties: { [p.id]: v } });
                await reload();
              }}
            />
          </div>
        </div>
      ))}
      <div className="flex items-center gap-1.5 pt-1 text-[12px] text-ink-3">
        <Bookmark size={12} />
        {bundle.collection.title || t.database}
      </div>
    </div>
  );
}
