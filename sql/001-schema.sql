-- Generated from immutable D1 schema; run once in a NEW target database.
CREATE SCHEMA IF NOT EXISTS kampit;
REVOKE ALL ON SCHEMA kampit FROM PUBLIC;
CREATE TABLE kampit."competitions" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace" text NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"kind" text NOT NULL,
	"creator_id" text,
	"code" text,
	"created_at" text NOT NULL
);
CREATE TABLE kampit."demo_sessions" (
	"token" text PRIMARY KEY NOT NULL,
	"workspace" text NOT NULL,
	"user_a" text NOT NULL,
	"user_b" text NOT NULL,
	"slot" text DEFAULT 'a' NOT NULL,
	"created_at" text NOT NULL
);
CREATE TABLE kampit."profiles" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace" text NOT NULL,
	"name" text NOT NULL,
	"interests" text DEFAULT '[]' NOT NULL,
	"timezone" text DEFAULT 'America/New_York' NOT NULL,
	"prime_demo" integer DEFAULT 0 NOT NULL,
	"onboarded" integer DEFAULT 0 NOT NULL,
	"created_at" text NOT NULL
);
CREATE TABLE kampit."competition_members" (
	"id" text PRIMARY KEY NOT NULL,
	"competition_id" text NOT NULL,
	"user_id" text NOT NULL,
	"created_at" text NOT NULL,
	FOREIGN KEY ("competition_id") REFERENCES kampit."competitions"("id") ON UPDATE no action ON DELETE no action,
	FOREIGN KEY ("user_id") REFERENCES kampit."profiles"("id") ON UPDATE no action ON DELETE no action
);
CREATE TABLE kampit."goals" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"template_id" text NOT NULL,
	"level" text NOT NULL,
	"archived" integer DEFAULT 0 NOT NULL,
	"created_at" text NOT NULL,
	FOREIGN KEY ("user_id") REFERENCES kampit."profiles"("id") ON UPDATE no action ON DELETE no action
);
CREATE TABLE kampit."daily_checkins" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"goal_id" text NOT NULL,
	"template_id" text NOT NULL,
	"local_date" text NOT NULL,
	"season_id" text NOT NULL,
	"base_points" integer NOT NULL,
	"verification" text NOT NULL,
	"evidence" text DEFAULT '' NOT NULL,
	"created_at" text NOT NULL,
	FOREIGN KEY ("user_id") REFERENCES kampit."profiles"("id") ON UPDATE no action ON DELETE no action,
	FOREIGN KEY ("goal_id") REFERENCES kampit."goals"("id") ON UPDATE no action ON DELETE no action
);
CREATE TABLE kampit."rank_history" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"scope_id" text NOT NULL,
	"season_id" text NOT NULL,
	"from_tier" text NOT NULL,
	"to_tier" text NOT NULL,
	"score" integer NOT NULL,
	"active_days" integer NOT NULL,
	"created_at" text NOT NULL,
	FOREIGN KEY ("user_id") REFERENCES kampit."profiles"("id") ON UPDATE no action ON DELETE no action
);
CREATE TABLE kampit."rank_records" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"scope_id" text NOT NULL,
	"tier" text DEFAULT 'Bronze' NOT NULL,
	"last_season" text NOT NULL,
	"updated_at" text NOT NULL,
	FOREIGN KEY ("user_id") REFERENCES kampit."profiles"("id") ON UPDATE no action ON DELETE no action
);
CREATE TABLE kampit."score_events" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"checkin_id" text NOT NULL,
	"local_date" text NOT NULL,
	"season_id" text NOT NULL,
	"requested" integer NOT NULL,
	"points" integer NOT NULL,
	"streak_bonus" integer DEFAULT 0 NOT NULL,
	"created_at" text NOT NULL,
	FOREIGN KEY ("user_id") REFERENCES kampit."profiles"("id") ON UPDATE no action ON DELETE no action,
	FOREIGN KEY ("checkin_id") REFERENCES kampit."daily_checkins"("id") ON UPDATE no action ON DELETE no action
);
CREATE TABLE kampit."seasons" (
	"id" text PRIMARY KEY NOT NULL,
	"starts_at" text NOT NULL,
	"ends_at" text NOT NULL
);
CREATE TABLE kampit."template_locks" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"template_id" text NOT NULL,
	"season_id" text NOT NULL,
	"level" text NOT NULL,
	FOREIGN KEY ("user_id") REFERENCES kampit."profiles"("id") ON UPDATE no action ON DELETE no action
);
CREATE UNIQUE INDEX "competition_members_unique" ON kampit."competition_members" ("competition_id","user_id");
CREATE UNIQUE INDEX "competitions_code_unique" ON kampit."competitions" ("code");
CREATE UNIQUE INDEX "checkins_template_day_unique" ON kampit."daily_checkins" ("user_id","template_id","local_date");
CREATE INDEX "checkins_user_date_idx" ON kampit."daily_checkins" ("user_id","local_date");
CREATE UNIQUE INDEX "goals_active_template_unique" ON kampit."goals" ("user_id","template_id") WHERE "goals"."archived" = 0;
CREATE INDEX "profiles_workspace_idx" ON kampit."profiles" ("workspace");
CREATE UNIQUE INDEX "rank_history_scope_season_unique" ON kampit."rank_history" ("user_id","scope_id","season_id");
CREATE UNIQUE INDEX "rank_records_scope_unique" ON kampit."rank_records" ("user_id","scope_id");
CREATE UNIQUE INDEX "score_events_checkin_unique" ON kampit."score_events" ("checkin_id");
CREATE INDEX "score_events_user_day_idx" ON kampit."score_events" ("user_id","local_date");
CREATE INDEX "score_events_season_idx" ON kampit."score_events" ("season_id");
CREATE UNIQUE INDEX "template_locks_unique" ON kampit."template_locks" ("user_id","template_id","season_id");
ALTER TABLE kampit."daily_checkins" ADD "task_prompt" text;

ALTER TABLE kampit."daily_checkins" ADD "task_title" text;

ALTER TABLE kampit."daily_checkins" ADD "task_level" text;

ALTER TABLE kampit."goals" ADD "next_level" text;

ALTER TABLE kampit."goals" ADD "next_level_starts_at" text;

ALTER TABLE kampit."rank_history" ADD "reason" text;

ALTER TABLE kampit."rank_history" ADD "position" integer;

ALTER TABLE kampit."rank_history" ADD "participants" integer;
