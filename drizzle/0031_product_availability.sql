ALTER TABLE `products` ADD `availability` enum('auto','low_stock','unavailable') NOT NULL DEFAULT 'auto';
