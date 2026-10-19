import {
  boolean,
  doublePrecision,
  index,
  jsonb,
  pgTable,
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
    position: doublePrecision("position").notNull().default(0),
    isFavorite: boolean("is_favorite").notNull().default(false),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("pages_parent_idx").on(t.parentId), index("pages_collection_idx").on(t.collectionId)],
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
