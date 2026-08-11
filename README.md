# Wornly — Hybrid Creator Marketplace

Wornly is a full-stack social-commerce marketplace built with Next.js, TypeScript, PostgreSQL/Neon, and Stripe. It supports products sold directly by Wornly and products dropshipped by approved creators or vendors. Rights-cleared creator posts can become product media after manual review in the same protected admin interface used to operate products, orders, inventory, fulfillment, refunds, and payouts.

## Repository and project location

- **GitHub:** https://github.com/ItMeansBigMountain/fashion-social
- **Local project folder:** `/opt/data/HeRmEz/projects/wornly`
- **Default branch:** `main`
- **Production site:** https://fashion-social-app.vercel.app
- **Architecture diagrams:** `/architecture`

The folder is a standalone Git repository with `origin` attached to the GitHub repository above. Local environment files, build outputs, Vercel metadata, test artifacts, and Hermes agent metadata are excluded by `.gitignore`.

## What is included

### Customer storefront

- API-backed catalog for first-party and creator/vendor listings
- Exact server-authoritative product variant IDs, pricing, stock, currency, tax, and shipping
- Seller and fulfillment labels such as `Sold by Wornly` and creator dropship attribution
- Approved creator-post media with creator attribution
- Persistent PostgreSQL cart and Stripe-hosted Checkout
- Order-status, support, privacy, shipping, returns, terms, and social-rights pages
- Responsive mobile layouts and signed anonymous voting

### Creator/vendor portal

- Passwordless creator invitations and revocable sessions
- Rights-cleared social-post submission
- Product and variant submission for manual review
- Stripe Connect onboarding
- Tracking-number submission
- Earnings and payout visibility

### Unified admin console

The protected `/admin` console handles:

- First-party products, variants, and inventory
- Creator invitations and accounts
- Creator product and media review
- Rights, attribution, and product-association moderation
- Purchase orders and receiving
- Wornly and creator fulfillment
- Tracking deadlines and delivery confirmation
- Delinquency exceptions and refund requests
- Returns, customer support, creator earnings, and payouts
- Auditable administrative mutations

### Marketplace automation

An hourly authenticated job at `/api/cron/marketplace`:

1. Detects creator-fulfilled lines without tracking 48 hours after payment.
2. Marks the line delinquent and hides the affected listing.
3. Reverses unpaid creator earnings.
4. Creates an idempotent refund request for merchandise and proportional tax; shipping is refunded only when the entire order failed.
5. Submits configured Stripe refunds.
6. Queues creator payouts after delivery and the 30-day return hold.
7. Uses verified Stripe webhooks to finalize refund and transfer states.

See [`/architecture`](https://fashion-social-app.vercel.app/architecture) for non-technical diagrams of customer, Wornly, creator/vendor, fulfillment, refund, money, and attribution flows.

## Technology

- Next.js 16 / React 19 / TypeScript
- PostgreSQL through Neon
- Stripe Checkout, webhooks, refunds, and Connect transfers
- Vitest unit and live-database integration tests
- Playwright desktop and mobile browser tests
- Vercel deployment and hourly cron

## Local setup

Requirements: Node.js 22+, npm, and a PostgreSQL/Neon connection string.

```bash
npm install
cp .env.example .env.local
npm run db:migrate
npm run db:seed
npm run dev
```

Open http://127.0.0.1:3000. The catalog and manual operations work without Stripe, but payment, automated refunds, Connect onboarding, and creator transfers remain disabled until Stripe is configured.

## Environment variables and secrets

Never commit real secret values. Put local values in `.env.local` and configure hosted values in Vercel project settings. `.env*` is ignored by Git, while `.env.example` safely lists variable names with blank placeholders.

| Variable | Required | Secret | Purpose |
|---|---:|---:|---|
| `DATABASE_URL` | Yes | Yes | PostgreSQL/Neon connection string used by migrations, catalog, carts, orders, admin, creators, and automation. |
| `NEXT_PUBLIC_SITE_URL` | Yes in production | No | Canonical HTTPS origin used for Stripe return URLs and Connect onboarding. Example: `https://fashion-social-app.vercel.app`. |
| `VOTE_COOKIE_SECRET` | Yes in production | Yes | Long random value used to sign anonymous voter identities. Without it, a process-local fallback is generated and changes across instances. |
| `CRON_SECRET` | Yes in production | Yes | Long random bearer token used to authenticate the hourly marketplace watchdog. Vercel Cron sends it as an `Authorization: Bearer <secret>` header. |
| `STRIPE_SECRET_KEY` | Required for payments/payouts | Yes | Stripe server key. Start with `sk_test_...`; never use it in browser code or prefix it with `NEXT_PUBLIC_`. |
| `STRIPE_WEBHOOK_SECRET` | Required for payment/refund/payout finalization | Yes | Stripe endpoint signing secret (`whsec_...`) used to verify webhook signatures. |
| `SHIPPO_API_TOKEN` | Optional | Yes | Reserved for Shippo-backed shipping. Manual fulfillment works without it. |
| `INSTAGRAM_ACCESS_TOKEN` | Optional | Yes | Official Instagram integration; manual rights-cleared submissions work without it. |
| `TIKTOK_ACCESS_TOKEN` | Optional | Yes | Official TikTok integration; manual rights-cleared submissions work without it. |
| `YOUTUBE_API_KEY` | Optional | Yes | Official YouTube data integration. |
| `PINTEREST_ACCESS_TOKEN` | Optional | Yes | Official Pinterest integration. |
| `PLAYWRIGHT_BASE_URL` | Optional for tests | No | Overrides the browser-test target; defaults to `http://127.0.0.1:3018`. |
| `NODE_ENV` | Set by framework | No | Controls production cookie security and framework behavior; do not normally set manually. |

Generate strong random signing/cron secrets with a password manager or cryptographically secure random generator. Do not paste secret values into issues, screenshots, logs, commits, or this README.

## Stripe setup

1. Enable Stripe Checkout and Stripe Connect Express in a test-mode Stripe account.
2. Configure `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_SITE_URL`, and `CRON_SECRET` in Vercel.
3. Register the production webhook endpoint:

   `https://fashion-social-app.vercel.app/api/stripe/webhook`

4. Subscribe it to:
   - `checkout.session.completed`
   - `checkout.session.expired`
   - `charge.refunded`
   - `refund.created`
   - `refund.updated`
   - `transfer.created`
   - `transfer.reversed`
5. Complete creator Connect onboarding using `/creator`.
6. Test Checkout, webhook replay/idempotency, refunds, and transfer reversals in Stripe test mode before using live credentials.

Payment, refund, and transfer state is finalized only from signature-verified Stripe webhooks. Browser-provided prices or totals are never trusted.

## Database

Migrations live in `migrations/001_initial.sql` through `migrations/011_creator_delivery_payouts.sql`.

```bash
npm run db:migrate
npm run db:seed
```

Migrations are repeatable. The seed command creates the first-party demonstration catalog; do not run it against production unless that catalog is desired.

## Verification

```bash
npm run db:migrate
npm test
npm run test:integration
npm run lint
npm run build
PLAYWRIGHT_BASE_URL=http://127.0.0.1:3000 npm run test:e2e
```

The integration suite uses `DATABASE_URL` and creates isolated temporary records. Browser tests cover persistent carts, exact variants, voting controls, six iPhone widths, overflow safety, and responsive architecture diagrams.

## Deployment

The repository includes `vercel.json` with an hourly marketplace cron. Git pushes to the connected Vercel project can auto-deploy, or deploy manually:

```bash
npx vercel --prod
```

Before production deployment:

- Configure every required environment variable above for Production and relevant Preview environments.
- Apply all database migrations.
- Register and verify the Stripe webhook endpoint.
- Confirm Stripe Connect is enabled.
- Run the complete verification commands.
- Verify `/`, `/architecture`, `/admin`, `/creator`, `/api/catalog`, cart behavior, unauthorized admin/creator APIs, and safe no-Stripe behavior on the canonical alias.

## Social-media rights and attribution

Wornly does not rely on arbitrary scraping. Creator media may be published only after explicit rights confirmation, attribution validation, manual approval, and product association. Official APIs, approved embeds, feeds/webhooks, or creator/admin-submitted canonical URLs should be used for future automated ingestion.

## Important operational decisions

Before taking live marketplace payments, the operator should formally decide and document seller-of-record, sales-tax ownership, returns liability, creator commission defaults, payout timing, chargeback/dispute handling, and customer-service responsibilities. The implementation provides the technical ledgers and safeguards but does not replace legal, tax, or accounting advice.
