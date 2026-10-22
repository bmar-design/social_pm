CREATE TABLE `blocks` (
	`user_id` text NOT NULL,
	`blocked_id` text NOT NULL,
	PRIMARY KEY(`user_id`, `blocked_id`)
);
--> statement-breakpoint
CREATE TABLE `deleted_accounts` (
	`user_hash` text PRIMARY KEY NOT NULL,
	`created` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `reports` (
	`id` text PRIMARY KEY NOT NULL,
	`reporter` text NOT NULL,
	`proposal_id` text NOT NULL,
	`reason` text NOT NULL,
	`created` integer NOT NULL
);
