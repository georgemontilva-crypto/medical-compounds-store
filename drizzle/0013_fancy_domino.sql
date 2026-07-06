CREATE TABLE `welcome_coupon_redemptions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`couponId` int NOT NULL,
	`redeemedAt` timestamp NOT NULL DEFAULT (now()),
	`orderId` int,
	`usedAt` timestamp,
	CONSTRAINT `welcome_coupon_redemptions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `coupons` ADD `isNewCustomerOffer` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `welcome_coupon_redemptions` ADD CONSTRAINT `welcome_coupon_redemptions_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `welcome_coupon_redemptions` ADD CONSTRAINT `welcome_coupon_redemptions_couponId_coupons_id_fk` FOREIGN KEY (`couponId`) REFERENCES `coupons`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `welcome_coupon_redemptions` ADD CONSTRAINT `welcome_coupon_redemptions_orderId_orders_id_fk` FOREIGN KEY (`orderId`) REFERENCES `orders`(`id`) ON DELETE no action ON UPDATE no action;