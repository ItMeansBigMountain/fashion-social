ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS media_url text;
-- statement-breakpoint
ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS media_alt text;
-- statement-breakpoint
ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS media_source text;
-- statement-breakpoint
ALTER TABLE products ADD COLUMN IF NOT EXISTS primary_social_post_id uuid REFERENCES social_posts(id);
-- statement-breakpoint
CREATE TABLE IF NOT EXISTS creator_invites(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),creator_account_id uuid NOT NULL REFERENCES creator_accounts(id) ON DELETE CASCADE,
 token_hash text UNIQUE NOT NULL,expires_at timestamptz NOT NULL,consumed_at timestamptz,created_at timestamptz NOT NULL DEFAULT now()
);
-- statement-breakpoint
CREATE TABLE IF NOT EXISTS creator_sessions(
 token_hash text PRIMARY KEY,creator_account_id uuid NOT NULL REFERENCES creator_accounts(id) ON DELETE CASCADE,
 expires_at timestamptz NOT NULL,last_seen_at timestamptz NOT NULL DEFAULT now(),created_at timestamptz NOT NULL DEFAULT now()
);
-- statement-breakpoint
CREATE OR REPLACE FUNCTION exchange_creator_invite(p_invite_hash text,p_session_hash text,p_session_expiry timestamptz)
RETURNS TABLE(creator_id uuid,email text,handle text,display_name text,status text) LANGUAGE plpgsql AS $$
DECLARE v_creator_id uuid;
BEGIN
 UPDATE creator_invites SET consumed_at=now() WHERE token_hash=p_invite_hash AND consumed_at IS NULL AND expires_at>now() RETURNING creator_account_id INTO v_creator_id;
 IF v_creator_id IS NULL THEN RETURN; END IF;
 INSERT INTO creator_sessions(token_hash,creator_account_id,expires_at) VALUES(p_session_hash,v_creator_id,p_session_expiry);
 RETURN QUERY SELECT c.id,c.email,c.handle,c.display_name,c.status FROM creator_accounts c WHERE c.id=v_creator_id;
END $$;
-- statement-breakpoint
INSERT INTO schema_migrations(version) VALUES('010_creator_portal_media') ON CONFLICT DO NOTHING;
