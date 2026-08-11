# Wornly

A social-proof fashion marketplace MVP built with Next.js, TypeScript, and Stripe Checkout. Wornly connects products to creator-post evidence and summarizes cumulative engagement as a visible heat score.

## Customer experience

- Browse a responsive visual fashion feed.
- Filter by category.
- See cumulative likes, creator-post counts, and social heat per product.
- Open a product to inspect attributed post snapshots and select a size.
- Like or dislike each item with one active vote per browser and changeable vote direction.
- Purchase through hosted Stripe Checkout when `STRIPE_SECRET_KEY` is configured.

## Community voting and rate limits

`/api/votes` issues an HTTP-only, HMAC-signed voter cookie and enforces three server-side limits:

- one active vote per browser per product;
- a three-second cooldown before changing the same product vote;
- 30 vote requests per browser per minute and a 120-request IP safety ceiling.

The included in-memory store makes the deployed MVP interactive but is not a durable global counter across Vercel function instances or cold starts. Before treating totals as production data, connect a shared Redis-compatible store such as Upstash/Vercel Marketplace and perform vote mutation plus rate-limit checks atomically there.

## Run locally

```bash
npm install
cp .env.example .env.local
npm run dev
```

Quality checks:

```bash
npm test
npm run lint
npm run build
npm run test:e2e
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
- `VOTE_COOKIE_SECRET` (a long random value for signing anonymous voter identities)
