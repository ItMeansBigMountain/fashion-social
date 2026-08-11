ALTER TABLE admin_users ALTER COLUMN password_hash DROP NOT NULL;
INSERT INTO schema_migrations(version) VALUES ('004_passwordless_admin') ON CONFLICT DO NOTHING;
