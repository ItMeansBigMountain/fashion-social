DO $$
BEGIN
 IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='admin_sessions' AND column_name='id_hash') THEN
  ALTER TABLE admin_sessions RENAME COLUMN id_hash TO token_hash;
 END IF;
 IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='admin_sessions' AND column_name='admin_user_id') THEN
  ALTER TABLE admin_sessions RENAME COLUMN admin_user_id TO admin_id;
 END IF;
END $$;
-- statement-breakpoint
ALTER TABLE admin_sessions ADD COLUMN IF NOT EXISTS last_seen_at timestamptz NOT NULL DEFAULT now();
-- statement-breakpoint
INSERT INTO schema_migrations(version) VALUES ('005_admin_session_columns') ON CONFLICT DO NOTHING;
