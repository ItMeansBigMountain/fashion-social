# Wornly

A social-proof fashion marketplace MVP built with Next.js, TypeScript, and Stripe Checkout. Wornly connects products to creator-post evidence and summarizes cumulative engagement as a visible heat score.

## Customer experience

- Browse a responsive visual fashion feed.
- Filter by category.
- See cumulative likes, creator-post counts, and social heat per product.
- Open a product to inspect attributed post snapshots and select a size.
- Purchase through hosted Stripe Checkout when `STRIPE_SECRET_KEY` is configured.

## Run locally

```bash
npm install
cp .env.example .env.local
npm run dev
```

The catalog works without secrets. Checkout intentionally returns a configuration message until a Stripe key is provided.

## Stripe

1. Create a Stripe account and start with a test-mode secret key.
2. Set `STRIPE_SECRET_KEY=sk_test_...` locally and in Vercel.
3. Set `NEXT_PUBLIC_SITE_URL` to the canonical deployment URL.
4. Use Stripe test cards to validate checkout before switching to live mode.

The server creates price data from trusted server-side catalog records. The browser sends only a product ID and size; client-provided pricing is never trusted.

## Social data architecture

The MVP uses clearly attributed seeded snapshots. Production ingestion should use one or more of:

- Meta Instagram Graph API for connected Business/Creator accounts and approved permissions.
- Creator/merchant submission with ownership or usage-right confirmation.
- Licensed affiliate/product feeds that map products to campaign posts.

Do not scrape Instagram or republish creator media without permission. A production data pipeline should store platform post IDs, creator authorization, product mapping, engagement snapshots, collection timestamps, and media usage rights. Recompute the heat score server-side on a schedule.

## Deployment

The project is Vercel-ready:

```bash
npx vercel --prod
```

Environment variables required for payment:

- `STRIPE_SECRET_KEY`
- `NEXT_PUBLIC_SITE_URL`
