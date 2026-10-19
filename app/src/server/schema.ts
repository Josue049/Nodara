import {
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

export const pages = pgTable(
  "pages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    parentId: uuid("parent_id").references((): AnyPgColumn => pages.id, {
      onDelete: "cascade",
    }),
    title: text("title").notNull().default(""),
    icon: text("icon"),
    content: jsonb("content").notNull().default([]),
    /** Texto plano del contenido, para búsqueda. */
    contentText: text("content_text").notNull().default(""),
    /** «page» | «database» (página completa que aloja una base de datos). */
    kind: text("kind").notNull().default("page"),
    /** Si no es nulo, esta página es un registro de la colección. */
    collectionId: uuid("collection_id").references((): AnyPgColumn => collections.id, { onDelete: "cascade" }),
    /** Valores de propiedades del registro, por id de propiedad. */
    properties: jsonb("properties").notNull().default({}),
    /** Espacio de trabajo propietario (nulo en datos anteriores a los usuarios; se adoptan en el primer registro). */
    workspaceId: uuid("workspace_id").references((): AnyPgColumn => workspaces.id, { onDelete: "cascade" }),
    creatorId: uuid("creator_id").references((): AnyPgColumn => users.id, { onDelete: "set null" }),
    /** «private» | «workspace»; nulo = hereda del padre (la raíz sin valor se trata como privada). */
    scope: text("scope"),
    position: doublePrecision("position").notNull().default(0),
    isFavorite: boolean("is_favorite").notNull().default(false),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("pages_parent_idx").on(t.parentId), index("pages_collection_idx").on(t.collectionId), index("pages_workspace_idx").on(t.workspaceId)],
);

export type PageRow = typeof pages.$inferSelect;

/** Una base de datos: define propiedades y vistas; sus registros son páginas con `collection_id`. */
export const collections = pgTable("collections", {
  id: uuid("id").primaryKey().defaultRandom(),
  /** Página que la aloja (página completa de base de datos o página que contiene el bloque integrado). */
  hostPageId: uuid("host_page_id")
    .notNull()
    .references((): AnyPgColumn => pages.id, { onDelete: "cascade" }),
  title: text("title").notNull().default(""),
  icon: text("icon"),
  isInline: boolean("is_inline").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const collectionProperties = pgTable(
  "collection_properties",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    collectionId: uuid("collection_id")
      .notNull()
      .references(() => collections.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    type: text("type").notNull(),
    config: jsonb("config").notNull().default({}),
    position: doublePrecision("position").notNull().default(0),
  },
  (t) => [index("collection_properties_collection_idx").on(t.collectionId)],
);

export const collectionViews = pgTable(
  "collection_views",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    collectionId: uuid("collection_id")
      .notNull()
      .references(() => collections.id, { onDelete: "cascade" }),
    name: text("name").notNull().default(""),
    type: text("type").notNull().default("table"),
    config: jsonb("config").notNull().default({}),
    position: doublePrecision("position").notNull().default(0),
  },
  (t) => [index("collection_views_collection_idx").on(t.collectionId)],
);

export const collectionTemplates = pgTable(
  "collection_templates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    collectionId: uuid("collection_id")
      .notNull()
      .references(() => collections.id, { onDelete: "cascade" }),
    name: text("name").notNull().default(""),
    title: text("title").notNull().default(""),
    properties: jsonb("properties").notNull().default({}),
    content: jsonb("content").notNull().default({}),
    position: doublePrecision("position").notNull().default(0),
  },
  (t) => [index("collection_templates_collection_idx").on(t.collectionId)],
);

// ── Usuarios, espacios de trabajo y permisos (Hito 5) ────────────────

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name").notNull().default(""),
  passwordHash: text("password_hash").notNull(),
  avatarColor: text("avatar_color").notNull().default("gray"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    /** SHA-256 del token de la cookie: la base nunca guarda el token en claro. */
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

export const workspaces = pgTable("workspaces", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  icon: text("icon"),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const workspaceMembers = pgTable(
  "workspace_members",
  {
    workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    /** owner | admin | member | guest */
    role: text("role").notNull().default("member"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.workspaceId, t.userId] }), index("workspace_members_user_idx").on(t.userId)],
);

export const invitations = pgTable(
  "invitations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    role: text("role").notNull().default("member"),
    /** Si existe, la invitación concede además acceso a esta página. */
    pageId: uuid("page_id").references((): AnyPgColumn => pages.id, { onDelete: "cascade" }),
    pageLevel: text("page_level"),
    tokenHash: text("token_hash").notNull().unique(),
    invitedBy: uuid("invited_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  },
  (t) => [index("invitations_email_idx").on(t.email)],
);

/** Permiso explícito de un usuario sobre una página (se hereda a sus descendientes). */
export const pagePermissions = pgTable(
  "page_permissions",
  {
    pageId: uuid("page_id").notNull().references((): AnyPgColumn => pages.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    /** view | comment | edit | full */
    level: text("level").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.pageId, t.userId] }), index("page_permissions_user_idx").on(t.userId)],
);

/** Enlace público de una página (publicar en la web). */
export const pageShares = pgTable("page_shares", {
  pageId: uuid("page_id").primaryKey().references((): AnyPgColumn => pages.id, { onDelete: "cascade" }),
  /** Token del enlace público (va en la URL; se guarda en claro para poder mostrar el enlace a quien administra la página). */
  token: text("token").notNull().unique(),
  /** view | comment | edit */
  level: text("level").notNull().default("view"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const favorites = pgTable(
  "favorites",
  {
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    pageId: uuid("page_id").notNull().references((): AnyPgColumn => pages.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.pageId] })],
);

export const pageVersions = pgTable(
  "page_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    pageId: uuid("page_id").notNull().references((): AnyPgColumn => pages.id, { onDelete: "cascade" }),
    title: text("title").notNull().default(""),
    content: jsonb("content").notNull().default({}),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("page_versions_page_idx").on(t.pageId, t.createdAt)],
);

/** Registro de archivos subidos (para autorizar su descarga por espacio de trabajo). */
export const files = pgTable("files", {
  id: uuid("id").primaryKey(),
  workspaceId: uuid("workspace_id").references(() => workspaces.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  size: integer("size").notNull().default(0),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
