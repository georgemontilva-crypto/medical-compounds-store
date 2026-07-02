CREATE TABLE `cart_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`productId` int NOT NULL,
	`variationId` int,
	`quantity` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `cart_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `categories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`slug` varchar(120) NOT NULL,
	`description` text,
	`color` varchar(20) DEFAULT '#6366f1',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `categories_id` PRIMARY KEY(`id`),
	CONSTRAINT `categories_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `coupons` (
	`id` int AUTO_INCREMENT NOT NULL,
	`code` varchar(50) NOT NULL,
	`type` enum('percentage','fixed') NOT NULL,
	`value` decimal(10,2) NOT NULL,
	`minOrderAmount` decimal(10,2),
	`maxUses` int,
	`usedCount` int NOT NULL DEFAULT 0,
	`active` boolean NOT NULL DEFAULT true,
	`expiresAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `coupons_id` PRIMARY KEY(`id`),
	CONSTRAINT `coupons_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `order_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orderId` int NOT NULL,
	`productId` int NOT NULL,
	`variationId` int,
	`productName` varchar(200) NOT NULL,
	`variationLabel` varchar(50),
	`quantity` int NOT NULL,
	`unitPrice` decimal(10,2) NOT NULL,
	`subtotal` decimal(10,2) NOT NULL,
	CONSTRAINT `order_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `orders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`status` enum('pending','confirmed','processing','shipped','delivered','cancelled') NOT NULL DEFAULT 'pending',
	`subtotal` decimal(10,2) NOT NULL,
	`discountAmount` decimal(10,2) NOT NULL DEFAULT '0',
	`total` decimal(10,2) NOT NULL,
	`couponId` int,
	`couponCode` varchar(50),
	`shippingFirstName` varchar(100),
	`shippingLastName` varchar(100),
	`shippingEmail` varchar(320),
	`shippingPhone` varchar(30),
	`shippingAddress` text,
	`shippingCity` varchar(100),
	`shippingState` varchar(100),
	`shippingZip` varchar(20),
	`shippingCountry` varchar(100),
	`paymentStatus` enum('pending','paid','failed','refunded') NOT NULL DEFAULT 'pending',
	`paymentMethod` varchar(50),
	`paymentReference` varchar(200),
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `orders_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `product_images` (
	`id` int AUTO_INCREMENT NOT NULL,
	`productId` int NOT NULL,
	`url` varchar(500) NOT NULL,
	`fileKey` varchar(500) NOT NULL,
	`altText` varchar(200),
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `product_images_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `product_variations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`productId` int NOT NULL,
	`unit` enum('mg','ml') NOT NULL,
	`value` decimal(10,2) NOT NULL,
	`price` decimal(10,2) NOT NULL,
	`stock` int NOT NULL DEFAULT 0,
	`sku` varchar(100),
	`active` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `product_variations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `products` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(200) NOT NULL,
	`slug` varchar(220) NOT NULL,
	`description` text,
	`shortDescription` varchar(500),
	`categoryId` int,
	`basePrice` decimal(10,2) NOT NULL,
	`featured` boolean NOT NULL DEFAULT false,
	`active` boolean NOT NULL DEFAULT true,
	`mechanism` text,
	`casNumber` varchar(50),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `products_id` PRIMARY KEY(`id`),
	CONSTRAINT `products_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `passwordHash` varchar(255);--> statement-breakpoint
ALTER TABLE `cart_items` ADD CONSTRAINT `cart_items_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cart_items` ADD CONSTRAINT `cart_items_productId_products_id_fk` FOREIGN KEY (`productId`) REFERENCES `products`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cart_items` ADD CONSTRAINT `cart_items_variationId_product_variations_id_fk` FOREIGN KEY (`variationId`) REFERENCES `product_variations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `order_items` ADD CONSTRAINT `order_items_orderId_orders_id_fk` FOREIGN KEY (`orderId`) REFERENCES `orders`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `order_items` ADD CONSTRAINT `order_items_productId_products_id_fk` FOREIGN KEY (`productId`) REFERENCES `products`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `order_items` ADD CONSTRAINT `order_items_variationId_product_variations_id_fk` FOREIGN KEY (`variationId`) REFERENCES `product_variations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `orders` ADD CONSTRAINT `orders_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `orders` ADD CONSTRAINT `orders_couponId_coupons_id_fk` FOREIGN KEY (`couponId`) REFERENCES `coupons`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `product_images` ADD CONSTRAINT `product_images_productId_products_id_fk` FOREIGN KEY (`productId`) REFERENCES `products`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `product_variations` ADD CONSTRAINT `product_variations_productId_products_id_fk` FOREIGN KEY (`productId`) REFERENCES `products`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `products` ADD CONSTRAINT `products_categoryId_categories_id_fk` FOREIGN KEY (`categoryId`) REFERENCES `categories`(`id`) ON DELETE no action ON UPDATE no action;