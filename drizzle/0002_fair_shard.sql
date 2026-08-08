CREATE TABLE `engagement_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`practiceSessionId` int,
	`eventType` varchar(100) NOT NULL,
	`points` int NOT NULL,
	`description` varchar(255) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `engagement_events_id` PRIMARY KEY(`id`),
	CONSTRAINT `engagement_event_unique` UNIQUE(`userId`,`eventType`,`practiceSessionId`)
);
--> statement-breakpoint
CREATE TABLE `user_achievements` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`achievementKey` varchar(100) NOT NULL,
	`unlockedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `user_achievements_id` PRIMARY KEY(`id`),
	CONSTRAINT `user_achievement_unique` UNIQUE(`userId`,`achievementKey`)
);
--> statement-breakpoint
CREATE TABLE `user_engagement` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`totalPoints` int NOT NULL DEFAULT 0,
	`currentLevel` int NOT NULL DEFAULT 1,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `user_engagement_id` PRIMARY KEY(`id`),
	CONSTRAINT `user_engagement_userId_unique` UNIQUE(`userId`)
);
