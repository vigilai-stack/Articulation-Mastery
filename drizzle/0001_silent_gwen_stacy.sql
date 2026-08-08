CREATE TABLE `journal_entries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`body` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `journal_entries_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `manager_assignments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`managerId` int NOT NULL,
	`learnerId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `manager_assignments_id` PRIMARY KEY(`id`),
	CONSTRAINT `manager_learner_unique` UNIQUE(`managerId`,`learnerId`)
);
--> statement-breakpoint
CREATE TABLE `notification_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`type` varchar(64) NOT NULL,
	`message` text NOT NULL,
	`readAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `notification_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `notification_schedules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`scheduleCronTaskUid` varchar(65),
	`cronExpression` varchar(100) NOT NULL,
	`enabled` enum('true','false') NOT NULL DEFAULT 'true',
	`lastSentAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `notification_schedules_id` PRIMARY KEY(`id`),
	CONSTRAINT `notification_schedules_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE TABLE `practice_sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`lessonDay` int NOT NULL,
	`responseMode` enum('text','audio') NOT NULL,
	`responseText` text NOT NULL,
	`transcript` text,
	`audioKey` varchar(512),
	`audioUrl` varchar(512),
	`status` enum('draft','submitted','reviewed') NOT NULL DEFAULT 'submitted',
	`clarityScore` int,
	`concisenessScore` int,
	`confidenceScore` int,
	`structureScore` int,
	`feedbackJson` json,
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `practice_sessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `user_profiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`goals` text NOT NULL,
	`baselineSelfAssessment` text NOT NULL,
	`baselineClarity` int NOT NULL,
	`baselineConciseness` int NOT NULL,
	`baselineConfidence` int NOT NULL,
	`baselineStructure` int NOT NULL,
	`notificationEnabled` enum('true','false') NOT NULL DEFAULT 'true',
	`reminderHour` int NOT NULL DEFAULT 9,
	`timezone` varchar(100) NOT NULL DEFAULT 'UTC',
	`onboardingCompleted` enum('true','false') NOT NULL DEFAULT 'false',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `user_profiles_id` PRIMARY KEY(`id`),
	CONSTRAINT `user_profiles_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('learner','manager','admin') NOT NULL DEFAULT 'learner';