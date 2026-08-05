PRAGMA defer_foreign_keys=ON;--> statement-breakpoint
CREATE TABLE `article_media` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`article_id` integer NOT NULL,
	`media_key` text NOT NULL,
	`draft_object_key` text,
	`draft_checksum` text,
	`draft_mime_type` text,
	`draft_filename` text,
	`draft_alt` text,
	`draft_role` text,
	`draft_position` integer,
	`published_object_key` text,
	`published_checksum` text,
	`published_mime_type` text,
	`published_filename` text,
	`published_alt` text,
	`published_role` text,
	`published_position` integer,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`article_id`) REFERENCES `articles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `article_media_article_id_id_unique` ON `article_media` (`article_id`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `article_media_article_id_media_key_unique` ON `article_media` (`article_id`,`media_key`);--> statement-breakpoint
ALTER TABLE `articles` RENAME TO `__old_articles`;--> statement-breakpoint
CREATE TABLE `articles` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`slug` text NOT NULL,
	`excerpt` text NOT NULL,
	`category_id` integer NOT NULL,
	`article_type` text DEFAULT 'comparison' NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`intro` text NOT NULL,
	`criteria_json` text NOT NULL,
	`recommendation` text NOT NULL,
	`affiliate_notice` text NOT NULL,
	`tested_by_top_comparativos` integer DEFAULT false NOT NULL,
	`source_key` text,
	`draft_content_json` text,
	`published_content_json` text,
	`draft_hero_media_id` integer,
	`published_hero_media_id` integer,
	`draft_version` integer DEFAULT 1 NOT NULL,
	`published_version` integer DEFAULT 1 NOT NULL,
	`reviewed_at` text,
	`published_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`id`,`draft_hero_media_id`) REFERENCES `article_media`(`article_id`,`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`id`,`published_hero_media_id`) REFERENCES `article_media`(`article_id`,`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `articles`("id", "title", "slug", "excerpt", "category_id", "article_type", "status", "intro", "criteria_json", "recommendation", "affiliate_notice", "tested_by_top_comparativos", "source_key", "draft_content_json", "published_content_json", "draft_hero_media_id", "published_hero_media_id", "draft_version", "published_version", "reviewed_at", "published_at", "created_at", "updated_at") SELECT "id", "title", "slug", "excerpt", "category_id", "article_type", "status", "intro", "criteria_json", "recommendation", "affiliate_notice", "tested_by_top_comparativos", NULL, NULL, NULL, NULL, NULL, 1, 1, "reviewed_at", "published_at", "created_at", "updated_at" FROM `__old_articles`;--> statement-breakpoint
CREATE TABLE `__new_article_products` (
	`article_id` integer NOT NULL,
	`product_id` integer NOT NULL,
	`position` integer NOT NULL,
	`verdict` text NOT NULL,
	`pros_json` text NOT NULL,
	`cons_json` text NOT NULL,
	FOREIGN KEY (`article_id`) REFERENCES `articles`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_article_products` SELECT * FROM `article_products`;--> statement-breakpoint
DROP TABLE `article_products`;--> statement-breakpoint
ALTER TABLE `__new_article_products` RENAME TO `article_products`;--> statement-breakpoint
CREATE TABLE `__new_sources` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`article_id` integer NOT NULL,
	`label` text NOT NULL,
	`url` text NOT NULL,
	`source_type` text NOT NULL,
	`checked_at` text NOT NULL,
	FOREIGN KEY (`article_id`) REFERENCES `articles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_sources` SELECT * FROM `sources`;--> statement-breakpoint
DROP TABLE `sources`;--> statement-breakpoint
ALTER TABLE `__new_sources` RENAME TO `sources`;--> statement-breakpoint
CREATE TABLE `__new_audit_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`article_id` integer,
	`action` text NOT NULL,
	`actor` text NOT NULL,
	`payload_json` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`article_id`) REFERENCES `articles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_audit_events` SELECT * FROM `audit_events`;--> statement-breakpoint
DROP TABLE `audit_events`;--> statement-breakpoint
ALTER TABLE `__new_audit_events` RENAME TO `audit_events`;--> statement-breakpoint
CREATE TABLE `__new_article_media` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`article_id` integer NOT NULL,
	`media_key` text NOT NULL,
	`draft_object_key` text,
	`draft_checksum` text,
	`draft_mime_type` text,
	`draft_filename` text,
	`draft_alt` text,
	`draft_role` text,
	`draft_position` integer,
	`published_object_key` text,
	`published_checksum` text,
	`published_mime_type` text,
	`published_filename` text,
	`published_alt` text,
	`published_role` text,
	`published_position` integer,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`article_id`) REFERENCES `articles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
DROP TABLE `article_media`;--> statement-breakpoint
ALTER TABLE `__new_article_media` RENAME TO `article_media`;--> statement-breakpoint
CREATE UNIQUE INDEX `article_media_article_id_id_unique` ON `article_media` (`article_id`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `article_media_article_id_media_key_unique` ON `article_media` (`article_id`,`media_key`);--> statement-breakpoint
CREATE TABLE `automation_operations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`operation` text NOT NULL,
	`request_id` text NOT NULL,
	`source_key` text NOT NULL,
	`body_sha256` text NOT NULL,
	`result_json` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `automation_operations_operation_request_id_unique` ON `automation_operations` (`operation`,`request_id`);--> statement-breakpoint
CREATE TABLE `article_draft_products` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`article_id` integer NOT NULL,
	`position` integer NOT NULL,
	`name` text NOT NULL,
	`brand` text NOT NULL,
	`asin` text NOT NULL,
	`affiliate_url` text NOT NULL,
	`affiliate_tag` text NOT NULL,
	`image_url` text,
	`verdict` text NOT NULL,
	`pros_json` text NOT NULL,
	`cons_json` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`article_id`) REFERENCES `articles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `article_draft_sources` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`article_id` integer NOT NULL,
	`label` text NOT NULL,
	`url` text NOT NULL,
	`source_type` text NOT NULL,
	`checked_at` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`article_id`) REFERENCES `articles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `media_gc_candidates` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`object_key` text NOT NULL,
	`state` text DEFAULT 'pending' NOT NULL,
	`claim_token` text,
	`claim_fencing_token` integer,
	`last_checked_at` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `media_gc_candidates_object_key_unique` ON `media_gc_candidates` (`object_key`);--> statement-breakpoint
CREATE INDEX `media_gc_candidates_state_last_checked_at_id_index` ON `media_gc_candidates` (`state`,`last_checked_at`,`id`);--> statement-breakpoint
CREATE TABLE `media_gc_lease` (
	`id` integer PRIMARY KEY NOT NULL,
	`owner_token` text,
	`fencing_token` integer DEFAULT 0 NOT NULL,
	`acquired_at` text,
	`expires_at` text,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `media_gc_state` (
	`id` integer PRIMARY KEY NOT NULL,
	`inventory_cursor` text,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
DROP TABLE `__old_articles`;--> statement-breakpoint
CREATE UNIQUE INDEX `articles_slug_unique` ON `articles` (`slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `articles_source_key_unique` ON `articles` (`source_key`);
