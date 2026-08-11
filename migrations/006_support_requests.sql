CREATE TABLE IF NOT EXISTS support_requests (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email text NOT NULL, order_id uuid REFERENCES orders(id) ON DELETE SET NULL,
 category text NOT NULL CHECK(category IN('order','shipping','return','product','privacy','rights','other')),
 message text NOT NULL, status text NOT NULL DEFAULT 'open' CHECK(status IN('open','in_progress','resolved','closed')),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS support_requests_status_idx ON support_requests(status,created_at DESC);
INSERT INTO schema_migrations(version) VALUES ('006_support_requests') ON CONFLICT DO NOTHING;
