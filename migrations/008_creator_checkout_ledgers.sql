CREATE OR REPLACE FUNCTION process_paid_checkout(
  p_event_id text, p_session_id text, p_payment_intent_id text, p_cart_id uuid, p_email text,
  p_shipping_cents integer, p_tax_cents integer, p_total_cents integer, p_address jsonb
) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE v_order_id uuid; v_subtotal integer; v_currency text; v_line_count integer; v_available_count integer;
BEGIN
 SELECT id INTO v_order_id FROM orders WHERE stripe_checkout_session_id=p_session_id;
 IF v_order_id IS NOT NULL THEN RETURN v_order_id; END IF;
 PERFORM 1 FROM carts WHERE id=p_cart_id AND status='active' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Active cart not found'; END IF;
 PERFORM v.id FROM product_variants v JOIN cart_items ci ON ci.variant_id=v.id WHERE ci.cart_id=p_cart_id FOR UPDATE;
 SELECT count(*),count(*) FILTER(WHERE v.active AND p.active AND p.review_status='approved' AND (v.inventory-v.reserved)>=ci.quantity),sum(v.price_cents*ci.quantity),min(p.currency)
 INTO v_line_count,v_available_count,v_subtotal,v_currency FROM cart_items ci JOIN product_variants v ON v.id=ci.variant_id JOIN products p ON p.id=v.product_id WHERE ci.cart_id=p_cart_id;
 IF v_line_count=0 THEN RAISE EXCEPTION 'Cart is empty'; END IF;
 IF v_available_count<>v_line_count THEN RAISE EXCEPTION 'One or more items are unavailable'; END IF;
 IF p_total_cents<>v_subtotal+p_shipping_cents+p_tax_cents THEN RAISE EXCEPTION 'Stripe total does not match server cart'; END IF;
 INSERT INTO payment_events(provider,event_id,event_type,payload_sha256) VALUES('stripe',p_event_id,'checkout.session.completed','verified') ON CONFLICT DO NOTHING;
 IF NOT FOUND THEN SELECT id INTO v_order_id FROM orders WHERE stripe_checkout_session_id=p_session_id; RETURN v_order_id; END IF;
 INSERT INTO orders(cart_id,stripe_checkout_session_id,stripe_payment_intent_id,email,status,currency,subtotal_cents,shipping_cents,tax_cents,total_cents,shipping_name,shipping_line1,shipping_line2,shipping_city,shipping_state,shipping_postal_code,shipping_country)
 VALUES(p_cart_id,p_session_id,p_payment_intent_id,p_email,'paid',v_currency,v_subtotal,p_shipping_cents,p_tax_cents,p_total_cents,p_address->>'name',p_address->>'line1',p_address->>'line2',p_address->>'city',p_address->>'state',p_address->>'postalCode',p_address->>'country') RETURNING id INTO v_order_id;
 INSERT INTO order_items(order_id,variant_id,sku,product_name,variant_label,unit_price_cents,quantity,line_total_cents)
 SELECT v_order_id,v.id,v.sku,p.name,v.label,v.price_cents,ci.quantity,v.price_cents*ci.quantity FROM cart_items ci JOIN product_variants v ON v.id=ci.variant_id JOIN products p ON p.id=v.product_id WHERE ci.cart_id=p_cart_id;
 INSERT INTO order_item_fulfillments(order_item_id,order_id,creator_account_id,fulfillment_model,status,tracking_deadline_at)
 SELECT oi.id,v_order_id,p.creator_account_id,p.fulfillment_model,CASE WHEN p.fulfillment_model='creator_dropship' THEN 'awaiting_tracking' ELSE 'warehouse_pending' END,
 CASE WHEN p.fulfillment_model='creator_dropship' THEN now()+interval '48 hours' END
 FROM order_items oi JOIN product_variants v ON v.id=oi.variant_id JOIN products p ON p.id=v.product_id WHERE oi.order_id=v_order_id;
 INSERT INTO creator_earnings(creator_account_id,order_item_id,gross_cents,platform_fee_cents,creator_net_cents)
 SELECT p.creator_account_id,oi.id,oi.line_total_cents,round(oi.line_total_cents*p.platform_fee_bps/10000.0)::integer,oi.line_total_cents-round(oi.line_total_cents*p.platform_fee_bps/10000.0)::integer
 FROM order_items oi JOIN product_variants v ON v.id=oi.variant_id JOIN products p ON p.id=v.product_id WHERE oi.order_id=v_order_id AND p.seller_type='creator';
 INSERT INTO inventory_movements(variant_id,quantity,reason,reference_type,reference_id,actor) SELECT variant_id,-quantity,'sale','order',v_order_id::text,'stripe-webhook' FROM cart_items WHERE cart_id=p_cart_id;
 UPDATE product_variants v SET inventory=v.inventory-ci.quantity,updated_at=now() FROM cart_items ci WHERE ci.cart_id=p_cart_id AND ci.variant_id=v.id;
 UPDATE carts SET status='converted',updated_at=now() WHERE id=p_cart_id;
 INSERT INTO audit_events(actor,action,entity_type,entity_id,metadata) VALUES('stripe-webhook','order.paid','order',v_order_id::text,jsonb_build_object('eventId',p_event_id));
 RETURN v_order_id;
END $$;
-- statement-breakpoint
INSERT INTO schema_migrations(version) VALUES('008_creator_checkout_ledgers') ON CONFLICT DO NOTHING;
