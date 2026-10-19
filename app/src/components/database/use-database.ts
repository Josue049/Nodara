"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PropertyConfig, PropertyDef, PropertyType, RecordRow, SelectOption, ViewConfig, ViewDef, ViewType } from "@/lib/collections/types";
import { useAccess } from "../access-context";
import { call, dbApi, type QueryResponse } from "./api";
import type { CellCtx } from "./cells";

const VIEW_KEY = (cid: string) => `nodara:view:${cid}`;

/** Estado y acciones de una base de datos: definición, filas de la vista activa y mutaciones. */
export function useDatabase(collectionId: string) {
  const { canEdit, publicToken } = useAccess();
  // Quien no puede editar puede explorar (filtrar, ordenar, agrupar) pero esos cambios solo viven en su navegador.
  const [localConfig, setLocalConfig] = useState<ViewConfig | null>(null);
  const [data, setData] = useState<QueryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [viewId, setViewId] = useState<string | undefined>(() => {
    try {
      return (typeof window === "undefined" ? null : localStorage.getItem(VIEW_KEY(collectionId))) ?? undefined;
    } catch {
      return undefined;
    }
  });
  const [search, setSearch] = useState("");
  const seq = useRef(0);

  const reload = useCallback(
    async (opts?: { viewId?: string; search?: string }) => {
      const n = ++seq.current;
      try {
        const q = { viewId: opts?.viewId ?? viewId, search: (opts?.search ?? search) || undefined, ...(localConfig ? { config: localConfig } : {}) };
        const res = publicToken ? await call<QueryResponse>(`/api/public/${publicToken}/databases/${collectionId}/query`, "POST", q) : await dbApi.query(collectionId, q);
        if (n === seq.current) {
          setData(res);
          setError(null);
        }
      } catch (e) {
        if (n === seq.current) {
          // Una vista guardada que ya no existe: vuelve a la primera.
          if (viewId && /Vista no encontrada/.test(String(e))) setViewId(undefined);
          else setError(e instanceof Error ? e.message : "Error");
        }
      }
    },
    [collectionId, viewId, search, localConfig, publicToken],
  );

  useEffect(() => {
    const id = setTimeout(() => void reload(), search ? 150 : 0);
    return () => clearTimeout(id);
  }, [reload, search]);

  const bundle = data?.bundle ?? null;
  const view: ViewDef | null = useMemo(() => bundle?.views.find((v) => v.id === viewId) ?? bundle?.views[0] ?? null, [bundle, viewId]);
  const props: PropertyDef[] = useMemo(() => bundle?.properties ?? [], [bundle]);

  const selectView = useCallback(
    (id: string) => {
      setViewId(id);
      try {
        localStorage.setItem(VIEW_KEY(collectionId), id);
      } catch {}
    },
    [collectionId],
  );

  const patchBundle = (fn: (b: QueryResponse["bundle"]) => QueryResponse["bundle"]) => setData((d) => (d ? { ...d, bundle: fn(d.bundle) } : d));

  // ── Vistas ──
  const updateViewConfig = useCallback(
    async (patch: Partial<ViewConfig>) => {
      if (!view) return;
      const config = { ...(localConfig ?? view.config), ...patch };
      if (!canEdit) {
        setLocalConfig(config);
        return;
      }
      patchBundle((b) => ({ ...b, views: b.views.map((v) => (v.id === view.id ? { ...v, config } : v)) }));
      await dbApi.updateView(view.id, { config });
      await reload();
    },
    [view, reload, localConfig, canEdit],
  );
  const updateView = useCallback(
    async (patch: { name?: string; type?: ViewType }) => {
      if (!view) return;
      // Al cambiar de capa se rellenan los valores necesarios (agrupación del tablero, propiedad de fecha).
      let config: ViewConfig | undefined;
      if (patch.type === "board" && !view.config.group) {
        const g = props.find((p) => p.type === "status") ?? props.find((p) => p.type === "select");
        if (g) config = { ...view.config, group: { propertyId: g.id } };
      }
      if ((patch.type === "calendar" || patch.type === "timeline") && !view.config.dateProperty) {
        const d = props.find((p) => p.type === "date");
        if (d) config = { ...view.config, dateProperty: d.id };
      }
      patchBundle((b) => ({ ...b, views: b.views.map((v) => (v.id === view.id ? { ...v, ...patch, ...(config ? { config } : {}) } : v)) }));
      await dbApi.updateView(view.id, { ...patch, ...(config ? { config } : {}) });
      await reload();
    },
    [view, reload, props],
  );
  const addView = useCallback(
    async (type: ViewType) => {
      const v = await dbApi.createView(collectionId, { type });
      selectView(v.id);
      await reload({ viewId: v.id });
      return v;
    },
    [collectionId, reload, selectView],
  );
  const duplicateView = useCallback(
    async (id: string) => {
      const v = await dbApi.duplicateView(id);
      selectView(v.id);
      await reload({ viewId: v.id });
    },
    [reload, selectView],
  );
  const deleteView = useCallback(
    async (id: string) => {
      await dbApi.deleteView(id);
      const next = bundle?.views.find((v) => v.id !== id)?.id;
      if (next) selectView(next);
      await reload({ viewId: next });
    },
    [bundle, reload, selectView],
  );

  // ── Propiedades ──
  const addProperty = useCallback(
    async (input: { name: string; type: PropertyType; config?: PropertyConfig; bidirectional?: boolean }) => {
      const p = await dbApi.addProperty(collectionId, input);
      await reload();
      return p;
    },
    [collectionId, reload],
  );
  const updateProperty = useCallback(
    async (id: string, patch: { name?: string; config?: PropertyConfig }) => {
      await dbApi.updateProperty(id, patch);
      await reload();
    },
    [reload],
  );
  const deleteProperty = useCallback(
    async (id: string) => {
      await dbApi.deleteProperty(id);
      await reload();
    },
    [reload],
  );
  const createOption = useCallback(
    async (propertyId: string, name: string): Promise<SelectOption> => {
      const { option } = await dbApi.addOption(propertyId, name);
      await reload();
      return option;
    },
    [reload],
  );

  // ── Registros ──
  const patchRowLocal = (id: string, fn: (r: RecordRow) => RecordRow) => setData((d) => (d ? { ...d, rows: d.rows.map((r) => (r.id === id ? fn(r) : r)) } : d));

  const setCell = useCallback(
    async (rowId: string, propertyId: string, value: unknown) => {
      patchRowLocal(rowId, (r) => ({ ...r, values: { ...r.values, [propertyId]: value as never } }));
      try {
        await dbApi.updateRecord(rowId, { properties: { [propertyId]: value } });
      } finally {
        await reload();
      }
    },
    [reload],
  );
  const setTitle = useCallback(
    async (rowId: string, title: string) => {
      patchRowLocal(rowId, (r) => ({ ...r, title }));
      try {
        await dbApi.updateRecord(rowId, { title });
      } finally {
        await reload();
      }
    },
    [reload],
  );
  const addRow = useCallback(
    async (init?: { title?: string; properties?: Record<string, unknown>; templateId?: string }) => {
      const r = await dbApi.addRecord(collectionId, init ?? {});
      // Fila visible al instante (edición del título sin esperar a la recarga); la recarga la ordena y calcula.
      const now = new Date().toISOString();
      setData((d) => (d ? { ...d, rows: [...d.rows, { id: r.id, title: init?.title ?? "", icon: null, createdAt: now, updatedAt: now, values: (init?.properties ?? {}) as RecordRow["values"] }] } : d));
      void reload();
      return r.id;
    },
    [collectionId, reload],
  );
  const deleteRow = useCallback(
    async (id: string) => {
      setData((d) => (d ? { ...d, rows: d.rows.filter((r) => r.id !== id) } : d));
      await dbApi.trashRecord(id);
      await reload();
    },
    [reload],
  );
  const duplicateRow = useCallback(
    async (id: string) => {
      const r = await dbApi.duplicateRecord(id);
      await reload();
      return r.id;
    },
    [reload],
  );

  /** Crea una plantilla a partir de un registro: título, valores guardados y contenido. */
  const saveAsTemplate = useCallback(
    async (rowId: string) => {
      const r = await call<{ page: { title: string; properties: Record<string, unknown>; content: unknown } }>(`/api/records/${rowId}`);
      const content = r.page.content && (r.page.content as { type?: string }).type === "doc" ? r.page.content : undefined;
      await dbApi.createTemplate(collectionId, { name: r.page.title || "Plantilla", title: r.page.title, properties: r.page.properties, content });
    },
    [collectionId],
  );

  // Falso positivo de react-hooks/refs: `createOption` solo usa el ref `seq` dentro de eventos, nunca al renderizar.
  // eslint-disable-next-line react-hooks/refs
  const ctx: CellCtx = useMemo(() => ({ refs: data?.refs ?? {}, createOption }), [data?.refs, createOption]);

  return {
    data,
    error,
    bundle,
    view: view && localConfig ? { ...view, config: localConfig } : view,
    canEdit,
    props,
    rows: data?.rows ?? [],
    groups: data?.groups,
    calculations: data?.calculations ?? {},
    total: data?.total ?? 0,
    ctx,
    search,
    setSearch,
    selectView,
    reload,
    updateViewConfig,
    updateView,
    addView,
    duplicateView,
    deleteView,
    addProperty,
    updateProperty,
    deleteProperty,
    createOption,
    setCell,
    setTitle,
    addRow,
    deleteRow,
    duplicateRow,
    saveAsTemplate,
  };
}

export type Database = ReturnType<typeof useDatabase>;
