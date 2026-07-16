CREATE TYPE "public"."generation_status" AS ENUM('pending', 'generating', 'ready', 'failed');
--> statement-breakpoint
CREATE TABLE "restaurant_generations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_url" text NOT NULL,
	"normalized_source" text NOT NULL,
	"status" "generation_status" DEFAULT 'pending' NOT NULL,
	"provider_checkpoint" jsonb,
	"published_data" jsonb,
	"slug" text,
	"safe_error" varchar(240),
	"lease_token" uuid,
	"lease_acquired_at" timestamp with time zone,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "restaurant_generations_normalized_source_unique" UNIQUE("normalized_source"),
	CONSTRAINT "restaurant_generations_slug_unique" UNIQUE("slug"),
	CONSTRAINT "ready_generation_has_publication" CHECK ("restaurant_generations"."status" <> 'ready' OR ("restaurant_generations"."slug" IS NOT NULL AND "restaurant_generations"."published_data" IS NOT NULL)),
	CONSTRAINT "generation_attempt_count_nonnegative" CHECK ("restaurant_generations"."attempt_count" >= 0)
);
