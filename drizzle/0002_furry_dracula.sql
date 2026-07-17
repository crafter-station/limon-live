ALTER TABLE "restaurant_generations" ADD COLUMN "menu_status" varchar(16) DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "restaurant_generations" ADD COLUMN "menu_data" jsonb;--> statement-breakpoint
ALTER TABLE "restaurant_generations" ADD COLUMN "menu_safe_error" varchar(240);