CREATE TABLE IF NOT EXISTS "schema_migrations" ("version" varchar NOT NULL PRIMARY KEY);
CREATE TABLE IF NOT EXISTS "ar_internal_metadata" ("key" varchar NOT NULL PRIMARY KEY, "value" varchar, "created_at" datetime(6) NOT NULL, "updated_at" datetime(6) NOT NULL);
CREATE TABLE IF NOT EXISTS "users" ("id" uuid NOT NULL PRIMARY KEY, "email" varchar NOT NULL, "name" varchar NOT NULL, "google_id" varchar NOT NULL, "youtube_token" text, "token_expiry" datetime(6), "created_at" datetime(6) NOT NULL, "updated_at" datetime(6) NOT NULL, "youtube_refresh_token" text);
CREATE UNIQUE INDEX "index_users_on_email" ON "users" ("email");
CREATE UNIQUE INDEX "index_users_on_google_id" ON "users" ("google_id");
CREATE TABLE IF NOT EXISTS "stream_sessions" ("id" uuid NOT NULL PRIMARY KEY, "user_id" uuid NOT NULL, "broadcast_id" varchar, "stream_key" text, "rtmp_url" varchar, "status" varchar DEFAULT 'created' NOT NULL, "quality" varchar DEFAULT '720p' NOT NULL, "started_at" datetime(6), "ended_at" datetime(6), "duration_sec" integer, "max_viewers" integer, "error_message" text, "created_at" datetime(6) NOT NULL, "updated_at" datetime(6) NOT NULL, CONSTRAINT "fk_rails_9f17d13ec0"
FOREIGN KEY ("user_id")
  REFERENCES "users" ("id")
);
CREATE INDEX "index_stream_sessions_on_user_id" ON "stream_sessions" ("user_id");
CREATE INDEX "index_stream_sessions_on_status" ON "stream_sessions" ("status");
CREATE TABLE IF NOT EXISTS "stream_stats" ("id" uuid NOT NULL PRIMARY KEY, "stream_session_id" uuid NOT NULL, "recorded_at" datetime(6) NOT NULL, "bitrate_kbps" integer, "fps" decimal(5,2), "dropped_frames" integer, "viewer_count" integer, "buffer_size_kb" integer, CONSTRAINT "fk_rails_f2016bfe8e"
FOREIGN KEY ("stream_session_id")
  REFERENCES "stream_sessions" ("id")
);
CREATE INDEX "index_stream_stats_on_stream_session_id" ON "stream_stats" ("stream_session_id");
CREATE INDEX "index_stream_stats_on_recorded_at" ON "stream_stats" ("recorded_at");
CREATE TABLE IF NOT EXISTS "quality_presets" ("id" uuid NOT NULL PRIMARY KEY, "name" varchar NOT NULL, "width" integer NOT NULL, "height" integer NOT NULL, "fps" integer NOT NULL, "bitrate" integer NOT NULL, "codec" varchar NOT NULL, "created_at" datetime(6) NOT NULL, "updated_at" datetime(6) NOT NULL);
CREATE UNIQUE INDEX "index_quality_presets_on_name" ON "quality_presets" ("name");
INSERT INTO "schema_migrations" (version) VALUES
('20260524000001'),
('20260523000004'),
('20260523000003'),
('20260523000002'),
('20260523000001');

