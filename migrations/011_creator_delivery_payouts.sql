DO $$ BEGIN
 ALTER TABLE creator_payouts DROP CONSTRAINT IF EXISTS creator_payouts_status_check;
 ALTER TABLE creator_payouts ADD CONSTRAINT creator_payouts_status_check CHECK(status IN('queued','processing','submitted','paid','failed','canceled'));
END $$;
-- statement-breakpoint
CREATE OR REPLACE FUNCTION mark_creator_fulfillment_delivered(p_fulfillment_id uuid,p_actor text,p_delivered_at timestamptz DEFAULT now()) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE v_id uuid;
BEGIN
 UPDATE order_item_fulfillments SET status='delivered',delivered_at=p_delivered_at,updated_at=now() WHERE id=p_fulfillment_id AND status IN('tracking_submitted','in_transit') RETURNING id INTO v_id;
 IF v_id IS NULL THEN RAISE EXCEPTION 'Fulfillment is not eligible for delivery'; END IF;
 UPDATE creator_earnings SET status='held',available_at=p_delivered_at+interval '30 days',updated_at=now() WHERE order_item_id=(SELECT order_item_id FROM order_item_fulfillments WHERE id=v_id) AND status IN('pending_fulfillment','held');
 INSERT INTO audit_events(actor,action,entity_type,entity_id,metadata) VALUES(p_actor,'creator_fulfillment.delivered','order_item_fulfillment',v_id::text,jsonb_build_object('earningsAvailableAt',p_delivered_at+interval '30 days'));
 RETURN v_id;
END $$;
-- statement-breakpoint
CREATE OR REPLACE FUNCTION queue_creator_payouts(p_now timestamptz DEFAULT now()) RETURNS TABLE(payout_id uuid,creator_id uuid,amount_cents integer) LANGUAGE plpgsql AS $$
DECLARE r record;v_payout uuid;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtext('queue_creator_payouts'));
 UPDATE creator_earnings e SET status='available',updated_at=now() WHERE e.status='held' AND e.available_at<=p_now
 AND NOT EXISTS(SELECT 1 FROM creator_payout_items cpi WHERE cpi.earning_id=e.id);
 FOR r IN SELECT creator_account_id,sum(creator_net_cents)::integer amount FROM creator_earnings WHERE status='available' GROUP BY creator_account_id HAVING sum(creator_net_cents)>0 LOOP
  INSERT INTO creator_payouts(creator_account_id,amount_cents,status) VALUES(r.creator_account_id,r.amount,'queued') RETURNING id INTO v_payout;
  INSERT INTO creator_payout_items(payout_id,earning_id) SELECT v_payout,id FROM creator_earnings WHERE creator_account_id=r.creator_account_id AND status='available';
  UPDATE creator_earnings SET status='held',updated_at=now() WHERE id IN(SELECT cpi.earning_id FROM creator_payout_items cpi WHERE cpi.payout_id=v_payout);
  payout_id:=v_payout;creator_id:=r.creator_account_id;amount_cents:=r.amount;RETURN NEXT;
 END LOOP;
END $$;
-- statement-breakpoint
INSERT INTO schema_migrations(version) VALUES('011_creator_delivery_payouts') ON CONFLICT DO NOTHING;
