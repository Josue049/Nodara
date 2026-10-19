CREATE TABLE "collection_properties" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"collection_id" uuid NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"position" double precision DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "collection_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"collection_id" uuid NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"properties" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"content" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"position" double precision DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "collection_views" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"collection_id" uuid NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"type" text DEFAULT 'table' NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"position" double precision DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "collections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"host_page_id" uuid NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"icon" text,
	"is_inline" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "pages" ADD COLUMN "kind" text DEFAULT 'page' NOT NULL;--> statement-breakpoint
ALTER TABLE "pages" ADD COLUMN "collection_id" uuid;--> statement-breakpoint
ALTER TABLE "pages" ADD COLUMN "properties" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "collection_properties" ADD CONSTRAINT "collection_properties_collection_id_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."collections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_templates" ADD CONSTRAINT "collection_templates_collection_id_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."collections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_views" ADD CONSTRAINT "collection_views_collection_id_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."collections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collections" ADD CONSTRAINT "collections_host_page_id_pages_id_fk" FOREIGN KEY ("host_page_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "collection_properties_collection_idx" ON "collection_properties" USING btree ("collection_id");--> statement-breakpoint
CREATE INDEX "collection_templates_collection_idx" ON "collection_templates" USING btree ("collection_id");--> statement-breakpoint
CREATE INDEX "collection_views_collection_idx" ON "collection_views" USING btree ("collection_id");--> statement-breakpoint
ALTER TABLE "pages" ADD CONSTRAINT "pages_collection_id_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."collections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "pages_collection_idx" ON "pages" USING btree ("collection_id");