import { z } from "zod";
import { OPTION_COLORS, PROPERTY_TYPES, VIEW_TYPES } from "@/lib/collections/types";


export const createPageSchema = z.object({
  parentId: z.uuid().nullable().optional(),
  workspaceId: z.uuid().optional(),
  title: z.string().max(500).optional(),
  icon: z.string().max(16).nullable().optional(),
});

export const updatePageSchema = z.object({
  title: z.string().max(500).optional(),
  icon: z.string().max(16).nullable().optional(),
  isFavorite: z.boolean().optional(),
  parentId: z.uuid().nullable().optional(),
  position: z.number().finite().optional(),
  content: z.looseObject({ type: z.literal("doc") }).optional(),
  cover: z.string().max(500).nullable().optional(),
  fontStyle: z.enum(["sans", "serif", "mono"]).optional(),
  smallText: z.boolean().optional(),
  fullWidth: z.boolean().optional(),
  locked: z.boolean().optional(),
});

// ── Bases de datos ───────────────────────────────────────────────────

const optionSchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().min(1).max(200),
  color: z.enum(OPTION_COLORS),
  group: z.enum(["todo", "in_progress", "done"]).optional(),
});

export const propertyConfigSchema = z
  .object({
    options: z.array(optionSchema).max(200).optional(),
    format: z.enum(["number", "number_with_commas", "percent", "usd", "eur"]).optional(),
    includeTime: z.boolean().optional(),
    relationCollectionId: z.uuid().optional(),
    reciprocalPropertyId: z.uuid().nullable().optional(),
    rollupRelationId: z.uuid().optional(),
    rollupTargetId: z.string().max(64).optional(),
    rollupFn: z
      .enum(["count", "count_values", "count_unique", "count_empty", "count_not_empty", "sum", "average", "median", "min", "max", "range", "show_original", "percent_checked"])
      .optional(),
    expression: z.string().max(2000).optional(),
  })
  .strict();

export const createDatabaseSchema = z.object({
  workspaceId: z.uuid().optional(),
  parentId: z.uuid().nullable().optional(),
  hostPageId: z.uuid().optional(),
  title: z.string().max(500).optional(),
});
export const updateCollectionSchema = z.object({ title: z.string().max(500).optional(), icon: z.string().max(16).nullable().optional() });
export const createPropertySchema = z.object({
  name: z.string().trim().min(1).max(100),
  type: z.enum(PROPERTY_TYPES),
  config: propertyConfigSchema.optional(),
  bidirectional: z.boolean().optional(),
});
export const updatePropertySchema = z.object({ name: z.string().trim().min(1).max(100).optional(), config: propertyConfigSchema.optional(), position: z.number().finite().optional() });
export const addOptionSchema = z.object({ name: z.string().trim().min(1).max(200), color: z.enum(OPTION_COLORS).optional(), group: z.enum(["todo", "in_progress", "done"]).optional() });
export const recordValuesSchema = z.record(z.string(), z.unknown());
export const createRecordSchema = z.object({ title: z.string().max(500).optional(), properties: recordValuesSchema.optional(), templateId: z.uuid().optional() });
export const updateRecordSchema = z.object({ title: z.string().max(500).optional(), icon: z.string().max(16).nullable().optional(), properties: recordValuesSchema.optional() });

const condition: z.ZodType = z.lazy(() =>
  z.union([
    z.object({ propertyId: z.string().max(64), operator: z.string().max(32), value: z.union([z.string().max(2000), z.number(), z.boolean(), z.null()]).optional() }),
    z.object({ op: z.enum(["and", "or"]), conditions: z.array(condition).max(50) }),
  ]),
);
export const viewConfigSchema = z
  .object({
    filter: z.object({ op: z.enum(["and", "or"]), conditions: z.array(condition).max(50) }).optional(),
    sorts: z.array(z.object({ propertyId: z.string().max(64), direction: z.enum(["asc", "desc"]) })).max(10).optional(),
    group: z.object({ propertyId: z.string().max(64), hideEmpty: z.boolean().optional(), hiddenGroups: z.array(z.string()).optional(), direction: z.enum(["asc", "desc"]).optional() }).nullable().optional(),
    visibleProperties: z.array(z.string().max(64)).max(200).optional(),
    calculations: z.record(z.string(), z.string()).optional(),
    showVerticalLines: z.boolean().optional(),
    showPageIcon: z.boolean().optional(),
    wrapCells: z.boolean().optional(),
    cardSize: z.enum(["small", "medium", "large"]).optional(),
    dateProperty: z.string().max(64).optional(),
    endDateProperty: z.string().max(64).nullable().optional(),
    openPagesIn: z.enum(["side", "center", "full"]).optional(),
    columnWidths: z.record(z.string(), z.number().min(40).max(1200)).optional(),
  })
  .strict();
export const createViewSchema = z.object({ name: z.string().trim().max(100).optional(), type: z.enum(VIEW_TYPES), config: viewConfigSchema.optional() });
export const updateViewSchema = z.object({ name: z.string().trim().max(100).optional(), type: z.enum(VIEW_TYPES).optional(), config: viewConfigSchema.optional() });
export const querySchema = z.object({ viewId: z.uuid().optional(), config: viewConfigSchema.optional(), search: z.string().max(200).optional() });
export const templateSchema = z.object({
  name: z.string().trim().min(1).max(100),
  title: z.string().max(500).optional(),
  properties: recordValuesSchema.optional(),
  content: z.looseObject({ type: z.literal("doc") }).optional(),
});

// ── Usuarios, espacios y compartir ───────────────────────────────────
const email = z.string().trim().toLowerCase().max(254).pipe(z.email());
export const signupSchema = z.object({ email, name: z.string().trim().min(1).max(100), password: z.string().min(8, "La contraseña necesita al menos 8 caracteres").max(200) });
export const loginSchema = z.object({ email, password: z.string().min(1).max(200) });
export const profileSchema = z.object({ name: z.string().trim().min(1).max(100).optional() });
export const passwordSchema = z.object({ current: z.string().min(1).max(200), next: z.string().min(8, "La contraseña necesita al menos 8 caracteres").max(200) });
export const workspaceSchema = z.object({ name: z.string().trim().min(1).max(100) });
export const workspacePatchSchema = z.object({ name: z.string().trim().min(1).max(100).optional(), icon: z.string().max(16).nullable().optional() });
const role = z.enum(["owner", "admin", "member", "guest"]);
const level = z.enum(["view", "comment", "edit", "full"]);
export const memberRoleSchema = z.object({ role });
export const invitationSchema = z.object({ email, role: role.default("member") });
export const shareSchema = z.object({ email, level });
export const permissionSchema = z.object({ level: level.nullable() });
export const scopeSchema = z.object({ scope: z.enum(["private", "workspace"]).nullable() });
export const publishSchema = z.object({ level: z.enum(["view", "comment", "edit"]) });
