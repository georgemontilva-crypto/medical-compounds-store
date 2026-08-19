CREATE TABLE `affiliate_codes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`code` varchar(32) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `affiliate_codes_id` PRIMARY KEY(`id`),
	CONSTRAINT `affiliate_codes_userId_unique` UNIQUE(`userId`),
	CONSTRAINT `affiliate_codes_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `affiliate_payout_requests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`amountRequested` decimal(10,2) NOT NULL,
	`status` enum('pending','paid','rejected') NOT NULL DEFAULT 'pending',
	`requestedAt` timestamp NOT NULL DEFAULT (now()),
	`paidAt` timestamp,
	`adminNotes` text,
	CONSTRAINT `affiliate_payout_requests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `affiliate_referrals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`affiliateCodeId` int NOT NULL,
	`orderId` int NOT NULL,
	`referredUserId` int,
	`commissionAmount` decimal(10,2) NOT NULL DEFAULT '0',
	`status` enum('pending','eligible','paid','rejected') NOT NULL DEFAULT 'pending',
	`payoutRequestId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `affiliate_referrals_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `points` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `affiliate_codes` ADD CONSTRAINT `affiliate_codes_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `affiliate_payout_requests` ADD CONSTRAINT `affiliate_payout_requests_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `affiliate_referrals` ADD CONSTRAINT `affiliate_referrals_affiliateCodeId_affiliate_codes_id_fk` FOREIGN KEY (`affiliateCodeId`) REFERENCES `affiliate_codes`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `affiliate_referrals` ADD CONSTRAINT `affiliate_referrals_orderId_orders_id_fk` FOREIGN KEY (`orderId`) REFERENCES `orders`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `affiliate_referrals` ADD CONSTRAINT `affiliate_referrals_referredUserId_users_id_fk` FOREIGN KEY (`referredUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `affiliate_payout_requests_user_status_idx` ON `affiliate_payout_requests` (`userId`,`status`);--> statement-breakpoint
CREATE INDEX `affiliate_referrals_code_status_idx` ON `affiliate_referrals` (`affiliateCodeId`,`status`);