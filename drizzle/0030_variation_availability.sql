ALTER TABLE `product_variations` ADD `availability` enum('auto','low_stock','unavailable') NOT NULL DEFAULT 'auto';
