ALTER TABLE `categories` ADD `heroImageUrl` varchar(500);--> statement-breakpoint
ALTER TABLE `categories` ADD `heroImageKey` varchar(500);--> statement-breakpoint
ALTER TABLE `categories` ADD `badgeCode` varchar(10);--> statement-breakpoint
ALTER TABLE `categories` ADD `tagline` varchar(300);--> statement-breakpoint
ALTER TABLE `categories` ADD `ctaText` varchar(50) DEFAULT 'Explore Category';--> statement-breakpoint
ALTER TABLE `categories` ADD `sortOrder` int DEFAULT 0 NOT NULL;