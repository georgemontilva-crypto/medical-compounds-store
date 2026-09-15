CREATE TABLE `campaign_stats` (
	`id` int AUTO_INCREMENT NOT NULL,
	`bucketStart` datetime NOT NULL,
	`campaign` varchar(80) NOT NULL,
	`source` varchar(128) NOT NULL,
	`visits` int NOT NULL DEFAULT 0,
	`engaged` int NOT NULL DEFAULT 0,
	CONSTRAINT `campaign_stats_id` PRIMARY KEY(`id`),
	CONSTRAINT `campaign_stats_bucket_campaign_source_idx` UNIQUE(`bucketStart`,`campaign`,`source`)
);
