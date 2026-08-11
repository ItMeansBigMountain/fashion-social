CREATE TABLE IF NOT EXISTS refund_request_items(
 refund_request_id uuid NOT NULL REFERENCES refund_requests(id) ON DELETE CASCADE,
 fulfillment_id uuid UNIQUE NOT NULL REFERENCES order_item_fulfillments(id),
 PRIMARY KEY(refund_request_id,fulfillment_id)
);
-- statement-breakpoint
CREATE OR REPLACE FUNCTION queue_delinquent_creator_refunds(p_now timestamptz DEFAULT now()) RETURNS TABLE(refund_request_id uuid,order_id uuid,amount_cents integer) LANGUAGE plpgsql AS $$
DECLARE rec record; v_refund_id uuid; v_amount integer;
BEGIN
 CREATE TEMP TABLE IF NOT EXISTS newly_overdue(id uuid,order_id uuid,order_item_id uuid,creator_account_id uuid) ON COMMIT DROP;
 TRUNCATE newly_overdue;
 INSERT INTO newly_overdue SELECT f.id,f.order_id,f.order_item_id,f.creator_account_id FROM order_item_fulfillments f
 WHERE f.fulfillment_model='creator_dropship' AND f.status='awaiting_tracking' AND f.tracking_deadline_at<=p_now FOR UPDATE OF f SKIP LOCKED;
 UPDATE order_item_fulfillments SET status='delinquent',updated_at=p_now WHERE id IN(SELECT id FROM newly_overdue);
 UPDATE products p SET active=false,review_status='delinquent',delinquent_at=p_now,hidden_reason='Creator did not submit shipment tracking within 48 hours',updated_at=p_now
 FROM product_variants v JOIN order_items oi ON oi.variant_id=v.id JOIN newly_overdue n ON n.order_item_id=oi.id WHERE p.id=v.product_id;
 UPDATE creator_earnings SET status='reversed',updated_at=p_now WHERE order_item_id IN(SELECT order_item_id FROM newly_overdue) AND status<>'paid';
 FOR rec IN SELECT n.order_id,sum(oi.line_total_cents)::integer delinquent_subtotal,o.subtotal_cents,o.shipping_cents,o.tax_cents,
   (SELECT count(*) FROM order_item_fulfillments f WHERE f.order_id=n.order_id) total_lines,count(*) delinquent_lines
   FROM newly_overdue n JOIN order_items oi ON oi.id=n.order_item_id JOIN orders o ON o.id=n.order_id GROUP BY n.order_id,o.subtotal_cents,o.shipping_cents,o.tax_cents
 LOOP
  v_amount:=rec.delinquent_subtotal+round(rec.tax_cents*rec.delinquent_subtotal::numeric/nullif(rec.subtotal_cents,0))::integer+CASE WHEN rec.delinquent_lines=rec.total_lines THEN rec.shipping_cents ELSE 0 END;
  INSERT INTO refund_requests(order_id,reason,amount_cents,status) VALUES(rec.order_id,'Creator tracking not submitted within 48 hours',v_amount,'queued') RETURNING id INTO v_refund_id;
  INSERT INTO refund_request_items(refund_request_id,fulfillment_id) SELECT v_refund_id,n.id FROM newly_overdue n WHERE n.order_id=rec.order_id;
  UPDATE order_item_fulfillments SET status='refund_queued',updated_at=p_now WHERE id IN(SELECT n.id FROM newly_overdue n WHERE n.order_id=rec.order_id);
  INSERT INTO audit_events(actor,action,entity_type,entity_id,metadata) VALUES('fulfillment-watchdog','creator.tracking_delinquent','order',rec.order_id::text,jsonb_build_object('refundRequestId',v_refund_id,'amountCents',v_amount));
  refund_request_id:=v_refund_id;order_id:=rec.order_id;amount_cents:=v_amount;RETURN NEXT;
 END LOOP;
END $$;
-- statement-breakpoint
CREATE OR REPLACE FUNCTION submit_creator_tracking(p_fulfillment_id uuid,p_creator_id uuid,p_carrier text,p_tracking_number text,p_tracking_url text) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE v_id uuid;
BEGIN
 UPDATE order_item_fulfillments SET carrier=p_carrier,tracking_number=p_tracking_number,tracking_url=p_tracking_url,status='tracking_submitted',submitted_at=now(),updated_at=now()
 WHERE id=p_fulfillment_id AND creator_account_id=p_creator_id AND status='awaiting_tracking' AND tracking_deadline_at>now() RETURNING id INTO v_id;
 IF v_id IS NULL THEN RAISE EXCEPTION 'Fulfillment is not eligible for tracking submission'; END IF;
 UPDATE creator_earnings SET status='held',updated_at=now() WHERE order_item_id=(SELECT order_item_id FROM order_item_fulfillments WHERE id=v_id);
 RETURN v_id;
END $$;
-- statement-breakpoint
CREATE OR REPLACE FUNCTION mark_creator_delivery(p_fulfillment_id uuid,p_delivered_at timestamptz DEFAULT now()) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE v_id uuid;
BEGIN
 UPDATE order_item_fulfillments SET status='delivered',delivered_at=p_delivered_at,updated_at=now() WHERE id=p_fulfillment_id AND status IN('tracking_submitted','in_transit') RETURNING id INTO v_id;
 IF v_id IS NULL THEN RAISE EXCEPTION 'Fulfillment cannot be marked delivered'; END IF;
 UPDATE creator_earnings SET status='held',available_at=p_delivered_at+interval '30 days',updated_at=now() WHERE order_item_id=(SELECT order_item_id FROM order_item_fulfillments WHERE id=v_id) AND status<>'reversed';
 RETURN v_id;
END $$;
-- statement-breakpoint
INSERT INTO schema_migrations(version) VALUES('009_creator_fulfillment_watchdog') ON CONFLICT DO NOTHING;
