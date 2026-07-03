ALTER TABLE `doc_integrity_section` MODIFY COLUMN `eyebrowText` varchar(100) DEFAULT 'DOCUMENTATION BY DESIGN';--> statement-breakpoint
ALTER TABLE `doc_integrity_section` MODIFY COLUMN `headingLine1` varchar(150) DEFAULT 'Research-grade integrity,';--> statement-breakpoint
ALTER TABLE `doc_integrity_section` MODIFY COLUMN `headingLine2` varchar(150) DEFAULT 'documented at every layer.';--> statement-breakpoint
ALTER TABLE `doc_integrity_section` MODIFY COLUMN `bodyText` text DEFAULT ('Brighter Days Labs documents every batch with lab-verified data researchers can trust — from synthesis to shipment.');--> statement-breakpoint
ALTER TABLE `doc_integrity_section` MODIFY COLUMN `cardBadge` varchar(50) DEFAULT 'COA-LINKED';--> statement-breakpoint
ALTER TABLE `doc_integrity_section` MODIFY COLUMN `cardSubtext` varchar(100) DEFAULT 'Lot-traceable';--> statement-breakpoint
ALTER TABLE `doc_integrity_section` MODIFY COLUMN `cardTitle` varchar(150) DEFAULT 'Batch-specific documentation';--> statement-breakpoint
ALTER TABLE `doc_integrity_section` MODIFY COLUMN `cardDetail` varchar(300) DEFAULT 'QR access on every vial · ≥98% HPLC verified · US-made, GMP-aligned';--> statement-breakpoint
ALTER TABLE `doc_integrity_section` MODIFY COLUMN `callout1Title` varchar(100) DEFAULT 'Pharmaceutical-Grade Sealing';--> statement-breakpoint
ALTER TABLE `doc_integrity_section` MODIFY COLUMN `callout1Description` varchar(300) DEFAULT 'Crimped aluminum cap ensures tamper-evidence and sterility during storage.';--> statement-breakpoint
ALTER TABLE `doc_integrity_section` MODIFY COLUMN `callout2Title` varchar(100) DEFAULT 'Verified Purity Label';--> statement-breakpoint
ALTER TABLE `doc_integrity_section` MODIFY COLUMN `callout2Description` varchar(300) DEFAULT 'Every vial displays dosage, ≥99% purity, and research-grade certification.';--> statement-breakpoint
ALTER TABLE `doc_integrity_section` MODIFY COLUMN `callout3Title` varchar(100) DEFAULT 'Research Use Compliance';--> statement-breakpoint
ALTER TABLE `doc_integrity_section` MODIFY COLUMN `callout3Description` varchar(300) DEFAULT 'Clearly marked for laboratory and scientific research applications only.';