CREATE TABLE `site_images` (
	`id` int AUTO_INCREMENT NOT NULL,
	`slotKey` varchar(100) NOT NULL,
	`url` varchar(500) NOT NULL,
	`fileKey` varchar(500) NOT NULL,
	`label` varchar(200) NOT NULL,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `site_images_id` PRIMARY KEY(`id`),
	CONSTRAINT `site_images_slotKey_unique` UNIQUE(`slotKey`)
);
