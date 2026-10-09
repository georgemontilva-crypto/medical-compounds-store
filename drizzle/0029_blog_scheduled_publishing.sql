ALTER TABLE `blog_posts` MODIFY `status` enum('draft','scheduled','published') NOT NULL DEFAULT 'draft';--> statement-breakpoint
ALTER TABLE `blog_posts` ADD `scheduledFor` timestamp NULL;--> statement-breakpoint
CREATE INDEX `blog_posts_scheduled_idx` ON `blog_posts` (`status`, `scheduledFor`);
