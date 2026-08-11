CREATE TABLE IF NOT EXISTS creator_accounts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email text UNIQUE NOT NULL, handle text UNIQUE NOT NULL,
 display_name text NOT NULL, stripe_account_id text UNIQUE, stripe_onboarding_status text NOT NULL DEFAULT 'not_started'
 CHECK(stripe_onboarding_status IN('not_started','pending','enabled','restricted','disabled')),
 status text NOT NULL DEFAULT 'pending' CHECK(status IN('pending','approved','suspended','closed')),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
-- statement-breakpoint
ALTER TABLE products ADD COLUMN IF NOT EXISTS seller_type text NOT NULL DEFAULT 'first_party' CHECK(seller_type IN('first_party','creator'));
-- statement-breakpoint
ALTER TABLE products ADD COLUMN IF NOT EXISTS creator_account_id uuid REFERENCES creator_accounts(id);
-- statement-breakpoint
ALTER TABLE products ADD COLUMN IF NOT EXISTS fulfillment_model text NOT NULL DEFAULT 'stocked' CHECK(fulfillment_model IN('stocked','creator_dropship'));
-- statement-breakpoint
ALTER TABLE products ADD COLUMN IF NOT EXISTS review_status text NOT NULL DEFAULT 'approved' CHECK(review_status IN('draft','pending','approved','rejected','delinquent'));
-- statement-breakpoint
ALTER TABLE products ADD COLUMN IF NOT EXISTS platform_fee_bps integer NOT NULL DEFAULT 2000 CHECK(platform_fee_bps BETWEEN 0 AND 10000);
-- statement-breakpoint
ALTER TABLE products ADD COLUMN IF NOT EXISTS delinquent_at timestamptz;
-- statement-breakpoint
ALTER TABLE products ADD COLUMN IF NOT EXISTS hidden_reason text;
-- statement-breakpoint
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='products_creator_ownership_check') THEN
  ALTER TABLE products ADD CONSTRAINT products_creator_ownership_check CHECK(
   (seller_type='first_party' AND creator_account_id IS NULL AND fulfillment_model='stocked') OR
   (seller_type='creator' AND creator_account_id IS NOT NULL AND fulfillment_model='creator_dropship')
  );
 END IF;
END $$;
-- statement-breakpoint
CREATE TABLE IF NOT EXISTS creator_product_submissions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), creator_account_id uuid NOT NULL REFERENCES creator_accounts(id),
 product_id text REFERENCES products(id), draft jsonb NOT NULL, social_post_ids uuid[] NOT NULL DEFAULT '{}',
 status text NOT NULL DEFAULT 'pending' CHECK(status IN('pending','approved','rejected','changes_requested','withdrawn')),
 review_notes text, submitted_at timestamptz NOT NULL DEFAULT now(), reviewed_at timestamptz, reviewed_by text
);
-- statement-breakpoint
CREATE TABLE IF NOT EXISTS order_item_fulfillments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), order_item_id uuid UNIQUE NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
 order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE, creator_account_id uuid REFERENCES creator_accounts(id),
 fulfillment_model text NOT NULL CHECK(fulfillment_model IN('stocked','creator_dropship')),
 status text NOT NULL DEFAULT 'awaiting_tracking' CHECK(status IN('warehouse_pending','awaiting_tracking','tracking_submitted','in_transit','delivered','delinquent','refund_queued','refunded','canceled')),
 tracking_deadline_at timestamptz, carrier text, tracking_number text, tracking_url text, submitted_at timestamptz,
 delivered_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
-- statement-breakpoint
CREATE INDEX IF NOT EXISTS fulfillment_deadline_idx ON order_item_fulfillments(status,tracking_deadline_at);
-- statement-breakpoint
CREATE TABLE IF NOT EXISTS refund_requests (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), order_id uuid NOT NULL REFERENCES orders(id), fulfillment_id uuid UNIQUE REFERENCES order_item_fulfillments(id),
 reason text NOT NULL, amount_cents integer NOT NULL CHECK(amount_cents>0), status text NOT NULL DEFAULT 'queued'
 CHECK(status IN('queued','processing','submitted','succeeded','failed','canceled')),
 stripe_refund_id text UNIQUE, attempt_count integer NOT NULL DEFAULT 0, last_error text,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
-- statement-breakpoint
CREATE TABLE IF NOT EXISTS creator_earnings (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), creator_account_id uuid NOT NULL REFERENCES creator_accounts(id),
 order_item_id uuid UNIQUE NOT NULL REFERENCES order_items(id), gross_cents integer NOT NULL CHECK(gross_cents>=0),
 platform_fee_cents integer NOT NULL CHECK(platform_fee_cents>=0), creator_net_cents integer NOT NULL CHECK(creator_net_cents>=0),
 status text NOT NULL DEFAULT 'pending_fulfillment' CHECK(status IN('pending_fulfillment','held','available','paid','reversed')),
 available_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK(gross_cents=platform_fee_cents+creator_net_cents)
);
-- statement-breakpoint
CREATE TABLE IF NOT EXISTS creator_payouts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), creator_account_id uuid NOT NULL REFERENCES creator_accounts(id),
 amount_cents integer NOT NULL CHECK(amount_cents>0), status text NOT NULL DEFAULT 'queued' CHECK(status IN('queued','processing','paid','failed','canceled')),
 stripe_transfer_id text UNIQUE, attempt_count integer NOT NULL DEFAULT 0, last_error text,
 created_at timestamptz NOT NULL DEFAULT now(), paid_at timestamptz
);
-- statement-breakpoint
CREATE TABLE IF NOT EXISTS creator_payout_items (
 payout_id uuid NOT NULL REFERENCES creator_payouts(id) ON DELETE CASCADE, earning_id uuid UNIQUE NOT NULL REFERENCES creator_earnings(id),
 PRIMARY KEY(payout_id,earning_id)
);
-- statement-breakpoint
INSERT INTO schema_migrations(version) VALUES('007_creator_marketplace') ON CONFLICT DO NOTHING;
