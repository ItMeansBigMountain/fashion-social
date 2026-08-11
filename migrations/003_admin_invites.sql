CREATE TABLE IF NOT EXISTS admin_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), admin_id uuid NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE, expires_at timestamptz NOT NULL, consumed_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
-- statement-breakpoint
CREATE OR REPLACE FUNCTION exchange_admin_invite(p_token_hash text,p_session_hash text,p_expires_at timestamptz)
RETURNS TABLE(admin_id uuid,email text,role text) LANGUAGE plpgsql AS $$
DECLARE v_admin admin_users%ROWTYPE;
BEGIN
  SELECT u.* INTO v_admin FROM admin_invites i JOIN admin_users u ON u.id=i.admin_id
   WHERE i.token_hash=p_token_hash AND i.consumed_at IS NULL AND i.expires_at>now() AND u.active FOR UPDATE OF i;
  IF v_admin.id IS NULL THEN RAISE EXCEPTION 'Invitation is invalid or expired'; END IF;
  UPDATE admin_invites SET consumed_at=now() WHERE token_hash=p_token_hash;
  INSERT INTO admin_sessions(admin_id,token_hash,expires_at) VALUES(v_admin.id,p_session_hash,p_expires_at);
  INSERT INTO audit_events(actor,action,entity_type,entity_id) VALUES(v_admin.email,'admin.session.created','admin_user',v_admin.id::text);
  RETURN QUERY SELECT v_admin.id,v_admin.email,v_admin.role;
END $$;
-- statement-breakpoint
INSERT INTO schema_migrations(version) VALUES ('003_admin_invites') ON CONFLICT DO NOTHING;
