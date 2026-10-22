CREATE TABLE `demo_trades` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`symbol` text NOT NULL,
	`event` text NOT NULL,
	`title` text NOT NULL,
	`opposite` text NOT NULL,
	`side` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`price_micros` integer NOT NULL,
	`contracts` integer NOT NULL,
	`cost_cents` integer NOT NULL,
	`created` integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE `proposals` ADD `trade_id` text;