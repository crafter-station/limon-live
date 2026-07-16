CREATE TABLE "submission_rate_limits" (
	"requester_key" varchar(64) NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"request_count" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "submission_rate_limits_requester_key_window_start_pk" PRIMARY KEY("requester_key","window_start"),
	CONSTRAINT "rate_limit_count_positive" CHECK ("submission_rate_limits"."request_count" > 0)
);
