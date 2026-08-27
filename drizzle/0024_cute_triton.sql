CREATE TABLE `page_view_stats` (
	`id` int AUTO_INCREMENT NOT NULL,
	`bucketStart` datetime NOT NULL,
	`path` varchar(255) NOT NULL,
	`views` int NOT NULL DEFAULT 0,
	`entries` int NOT NULL DEFAULT 0,
	CONSTRAINT `page_view_stats_id` PRIMARY KEY(`id`),
	CONSTRAINT `page_view_stats_bucket_path_idx` UNIQUE(`bucketStart`,`path`)
);
--> statement-breakpoint
CREATE TABLE `traffic_source_stats` (
	`id` int AUTO_INCREMENT NOT NULL,
	`bucketStart` datetime NOT NULL,
	`source` varchar(128) NOT NULL,
	`visits` int NOT NULL DEFAULT 0,
	CONSTRAINT `traffic_source_stats_id` PRIMARY KEY(`id`),
	CONSTRAINT `traffic_source_stats_bucket_source_idx` UNIQUE(`bucketStart`,`source`)
);
