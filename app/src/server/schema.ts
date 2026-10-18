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
    position: doublePrecision("position").notNull().default(0),
    isFavorite: boolean("is_favorite").notNull().default(false),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("pages_parent_idx").on(t.parentId)],
);

export type PageRow = typeof pages.$inferSelect;
