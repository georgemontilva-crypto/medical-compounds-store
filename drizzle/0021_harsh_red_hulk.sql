CREATE TABLE `shipping_labels` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orderId` int NOT NULL,
	`trackingNumber` varchar(50) NOT NULL,
	`serviceCode` varchar(10) NOT NULL,
	`format` varchar(10) NOT NULL,
	`data` longtext NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `shipping_labels_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `orders` ADD `shippingService` varchar(10);--> statement-breakpoint
ALTER TABLE `orders` ADD `shippingServiceName` varchar(60);--> statement-breakpoint
ALTER TABLE `orders` ADD `shippingCost` decimal(10,2) DEFAULT '0.00' NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `trackingNumber` varchar(50);--> statement-breakpoint
ALTER TABLE `orders` ADD `shippedAt` timestamp;--> statement-breakpoint
ALTER TABLE `shipping_labels` ADD CONSTRAINT `shipping_labels_orderId_orders_id_fk` FOREIGN KEY (`orderId`) REFERENCES `orders`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `shipping_labels_order_idx` ON `shipping_labels` (`orderId`);