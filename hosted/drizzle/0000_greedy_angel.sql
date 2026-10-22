CREATE TABLE `groups` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`owner` text NOT NULL,
	`invite` text NOT NULL,
	`created` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `groups_invite_unique` ON `groups` (`invite`);--> statement-breakpoint
CREATE TABLE `members` (
	`group_id` text NOT NULL,
	`user_id` text NOT NULL,
	`joined` integer NOT NULL,
	PRIMARY KEY(`group_id`, `user_id`),
	FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `proposals` (
	`id` text PRIMARY KEY NOT NULL,
	`group_id` text NOT NULL,
	`author` text NOT NULL,
	`symbol` text NOT NULL,
	`event` text NOT NULL,
	`title` text NOT NULL,
	`opposite` text NOT NULL,
	`side` text NOT NULL,
	`note` text NOT NULL,
	`created` integer NOT NULL,
	FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `responses` (
	`proposal_id` text NOT NULL,
	`user_id` text NOT NULL,
	`stance` text NOT NULL,
	`created` integer NOT NULL,
	PRIMARY KEY(`proposal_id`, `user_id`),
	FOREIGN KEY (`proposal_id`) REFERENCES `proposals`(`id`) ON UPDATE no action ON DELETE no action
);
