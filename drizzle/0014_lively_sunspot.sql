CREATE TABLE `hero_slides_config` (
	`id` int AUTO_INCREMENT NOT NULL,
	`slotKey` varchar(100) NOT NULL,
	`active` boolean NOT NULL DEFAULT true,
	`animationEnabled` boolean NOT NULL DEFAULT true,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `hero_slides_config_id` PRIMARY KEY(`id`),
	CONSTRAINT `hero_slides_config_slotKey_unique` UNIQUE(`slotKey`)
);
