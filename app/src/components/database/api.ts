import type {
  CollectionBundle,
  PropertyConfig,
  PropertyDef,
  PropertyType,
  QueryResult,
  SelectOption,
  TemplateDef,
  ViewConfig,
  ViewDef,
  ViewType,
} from "@/lib/collections/types";

export async function call<T>(url: string, method = "GET", body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? `HTTP ${res.status}`);
  return res.status === 204 ? (undefined as T) : res.json();
}

export type QueryResponse = QueryResult & { bundle: CollectionBundle };

export const dbApi = {
  query: (cid: string, q: { viewId?: string; config?: ViewConfig; search?: string }) => call<QueryResponse>(`/api/databases/${cid}/query`, "POST", q),
  list: () => call<{ id: string; title: string; icon: string | null; isInline: boolean }[]>("/api/databases"),
  bundle: (cid: string) => call<CollectionBundle>(`/api/databases/${cid}`),
  bundleForPage: (pageId: string) => call<CollectionBundle>(`/api/pages/${pageId}/database`),
  create: (input: { parentId?: string | null; hostPageId?: string; title?: string }) =>
    call<CollectionBundle & { page: { id: string } }>("/api/databases", "POST", input),
  updateCollection: (cid: string, patch: { title?: string; icon?: string | null }) => call(`/api/databases/${cid}`, "PATCH", patch),
  addProperty: (cid: string, input: { name: string; type: PropertyType; config?: PropertyConfig; bidirectional?: boolean }) =>
    call<PropertyDef>(`/api/databases/${cid}/properties`, "POST", input),
  updateProperty: (id: string, patch: { name?: string; config?: PropertyConfig; position?: number }) => call<PropertyDef>(`/api/properties/${id}`, "PATCH", patch),
  deleteProperty: (id: string) => call<void>(`/api/properties/${id}`, "DELETE"),
  addOption: (pid: string, name: string) => call<{ property: PropertyDef; option: SelectOption }>(`/api/properties/${pid}/options`, "POST", { name }),
  addRecord: (cid: string, input: { title?: string; properties?: Record<string, unknown>; templateId?: string }) =>
    call<{ id: string }>(`/api/databases/${cid}/records`, "POST", input),
  updateRecord: (id: string, patch: { title?: string; icon?: string | null; properties?: Record<string, unknown> }) => call(`/api/records/${id}`, "PATCH", patch),
  trashRecord: (id: string) => call<void>(`/api/pages/${id}`, "DELETE"),
  duplicateRecord: (id: string) => call<{ id: string }>(`/api/pages/${id}/duplicate`, "POST"),
  createView: (cid: string, input: { name?: string; type: ViewType; config?: ViewConfig }) => call<ViewDef>(`/api/databases/${cid}/views`, "POST", input),
  updateView: (id: string, patch: { name?: string; type?: ViewType; config?: ViewConfig }) => call<ViewDef>(`/api/views/${id}`, "PATCH", patch),
  deleteView: (id: string) => call<void>(`/api/views/${id}`, "DELETE"),
  duplicateView: (id: string) => call<ViewDef>(`/api/views/${id}/duplicate`, "POST"),
  templates: (cid: string) => call<TemplateDef[]>(`/api/databases/${cid}/templates`),
  createTemplate: (cid: string, input: { name: string; title?: string; properties?: Record<string, unknown>; content?: unknown }) =>
    call<TemplateDef>(`/api/databases/${cid}/templates`, "POST", input),
  updateTemplate: (id: string, patch: { name?: string; title?: string; properties?: Record<string, unknown>; content?: unknown }) =>
    call<TemplateDef>(`/api/templates/${id}`, "PATCH", patch),
  deleteTemplate: (id: string) => call<void>(`/api/templates/${id}`, "DELETE"),
};
