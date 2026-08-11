CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS schema_migrations (
  version text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS products (
  id text PRIMARY KEY, slug text UNIQUE NOT NULL, name text NOT NULL, brand text NOT NULL,
  category text NOT NULL, description text NOT NULL, currency text NOT NULL DEFAULT 'usd',
  image_url text NOT NULL, image_alt text NOT NULL, color text NOT NULL,
  active boolean NOT NULL DEFAULT true, featured boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS product_variants (
  id text PRIMARY KEY, product_id text NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  sku text UNIQUE NOT NULL, label text NOT NULL, price_cents integer NOT NULL CHECK (price_cents >= 0),
  inventory integer NOT NULL DEFAULT 0 CHECK (inventory >= 0), reserved integer NOT NULL DEFAULT 0 CHECK (reserved >= 0),
  weight_grams integer NOT NULL DEFAULT 0 CHECK (weight_grams >= 0), active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(product_id, label), CHECK (reserved <= inventory)
);
CREATE TABLE IF NOT EXISTS carts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','converted','abandoned')),
  email text, expires_at timestamptz NOT NULL DEFAULT now() + interval '30 days', created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS cart_items (
  cart_id uuid NOT NULL REFERENCES carts(id) ON DELETE CASCADE, variant_id text NOT NULL REFERENCES product_variants(id),
  quantity integer NOT NULL CHECK (quantity BETWEEN 1 AND 20), PRIMARY KEY(cart_id, variant_id)
);
CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), order_number bigint GENERATED ALWAYS AS IDENTITY UNIQUE,
  cart_id uuid REFERENCES carts(id), stripe_checkout_session_id text UNIQUE, stripe_payment_intent_id text UNIQUE,
  email text NOT NULL, status text NOT NULL DEFAULT 'pending_payment' CHECK (status IN ('pending_payment','paid','processing','shipped','delivered','canceled','refunded')),
  currency text NOT NULL, subtotal_cents integer NOT NULL CHECK (subtotal_cents >= 0), shipping_cents integer NOT NULL DEFAULT 0,
  tax_cents integer NOT NULL DEFAULT 0, total_cents integer NOT NULL CHECK (total_cents >= 0),
  shipping_name text, shipping_line1 text, shipping_line2 text, shipping_city text, shipping_state text, shipping_postal_code text, shipping_country text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  variant_id text REFERENCES product_variants(id), sku text NOT NULL, product_name text NOT NULL, variant_label text NOT NULL,
  unit_price_cents integer NOT NULL, quantity integer NOT NULL CHECK (quantity > 0), line_total_cents integer NOT NULL
);
CREATE TABLE IF NOT EXISTS inventory_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), variant_id text NOT NULL REFERENCES product_variants(id),
  quantity integer NOT NULL CHECK (quantity <> 0), reason text NOT NULL, reference_type text, reference_id text,
  actor text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS payment_events (
  provider text NOT NULL, event_id text NOT NULL, event_type text NOT NULL, payload_sha256 text NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(provider, event_id)
);
CREATE TABLE IF NOT EXISTS shipments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), order_id uuid NOT NULL REFERENCES orders(id), provider text NOT NULL DEFAULT 'manual',
  provider_shipment_id text, carrier text, service text, tracking_number text, tracking_url text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','label_purchased','in_transit','delivered','exception','returned')),
  label_url text, shipped_at timestamptz, delivered_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), vendor text NOT NULL, status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','ordered','partially_received','received','canceled')),
  expected_at date, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS purchase_order_items (
  purchase_order_id uuid NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE, variant_id text NOT NULL REFERENCES product_variants(id),
  ordered_quantity integer NOT NULL CHECK (ordered_quantity > 0), received_quantity integer NOT NULL DEFAULT 0 CHECK (received_quantity >= 0),
  unit_cost_cents integer CHECK (unit_cost_cents >= 0), PRIMARY KEY(purchase_order_id, variant_id), CHECK (received_quantity <= ordered_quantity)
);
CREATE TABLE IF NOT EXISTS returns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), order_id uuid NOT NULL REFERENCES orders(id), status text NOT NULL DEFAULT 'requested' CHECK (status IN ('requested','approved','rejected','in_transit','received','refunded','closed')),
  reason text NOT NULL, tracking_number text, refund_cents integer CHECK (refund_cents >= 0), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS social_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), platform text NOT NULL CHECK (platform IN ('instagram','tiktok','youtube','pinterest')),
  external_id text NOT NULL, canonical_url text NOT NULL UNIQUE, creator_handle text, caption_excerpt text,
  submitter_email text NOT NULL, rights_confirmed boolean NOT NULL DEFAULT false, rights_basis text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','removed')),
  moderated_by text, moderated_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(platform, external_id)
);
CREATE TABLE IF NOT EXISTS product_social_posts (
  product_id text NOT NULL REFERENCES products(id) ON DELETE CASCADE, social_post_id uuid NOT NULL REFERENCES social_posts(id) ON DELETE CASCADE,
  relationship text NOT NULL DEFAULT 'submitted' CHECK (relationship IN ('submitted','campaign','merchant_tag','admin_curated','suggested')),
  confidence numeric(4,3) CHECK (confidence BETWEEN 0 AND 1), public boolean NOT NULL DEFAULT false,
  PRIMARY KEY(product_id, social_post_id)
);
CREATE TABLE IF NOT EXISTS engagement_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), social_post_id uuid NOT NULL REFERENCES social_posts(id) ON DELETE CASCADE,
  likes bigint CHECK (likes >= 0), comments bigint CHECK (comments >= 0), views bigint CHECK (views >= 0), captured_at timestamptz NOT NULL DEFAULT now(), source text NOT NULL
);
CREATE TABLE IF NOT EXISTS admin_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email text UNIQUE NOT NULL, password_hash text NOT NULL,
  role text NOT NULL DEFAULT 'owner' CHECK (role IN ('owner','manager','catalog','fulfillment','support')),
  active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now(), last_login_at timestamptz
);
CREATE TABLE IF NOT EXISTS admin_sessions (
  id_hash text PRIMARY KEY, admin_user_id uuid NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), actor text NOT NULL, action text NOT NULL, entity_type text NOT NULL,
  entity_id text NOT NULL, metadata jsonb NOT NULL DEFAULT '{}'::jsonb, ip_hash text, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_variants_product ON product_variants(product_id);
CREATE INDEX IF NOT EXISTS idx_orders_status_created ON orders(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_social_status_created ON social_posts(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_snapshots_post_time ON engagement_snapshots(social_post_id, captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_events(created_at DESC);
INSERT INTO schema_migrations(version) VALUES ('001_initial') ON CONFLICT DO NOTHING;
