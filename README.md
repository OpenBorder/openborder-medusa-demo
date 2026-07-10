# Open Border × Medusa demo

A standalone checkout preview and provider adapter harness for the published
[`@open-border/medusa-payment-openborder`](https://www.npmjs.com/package/@open-border/medusa-payment-openborder)
package.

The demo shows how a Medusa-shaped cart can hand tax, duty, payment authorization, and entity
routing to Open Border. It consumes only public npm packages and does not require access to the
private Open Border monorepo.

> This repository is not a complete Medusa application. It does not start a Medusa backend or
> create a real Medusa order. The default preview uses clearly marked demo identifiers. Use the
> package registration example below inside a real Medusa v2 project.

## What you can run safely

| Mode | Purpose | Credentials | Public hosting |
| --- | --- | --- | --- |
| Preview | Visual buyer-flow walkthrough | None | Yes, as static files |
| API-backed Test mode | Local adapter smoke against a supported Test API | Test keys only | No |
| Live mode | Real-money activity | Unsupported | No |

## Quick start: keyless preview

Requirements: Node.js 20+ and Corepack.

```bash
corepack enable
pnpm install
pnpm start
```

Open <http://127.0.0.1:8000>. Preview mode is the default, makes no Open Border API calls, and
uses deterministic demo quote and authorization results.

Try the presenter flow:

1. Show the **Global Travel Hoodie**.
2. Switch the market from United States to United Kingdom.
3. Watch the postal code, currency, tax, duty, total, and routing label update.
4. Select **Pay with Open Border**.
5. Show the demo order reference and demo Open Border payment-intent reference.
6. Point out that the result says **authorized**, not captured or paid.

## Build a static hosted preview

```bash
pnpm build:hosted-preview
```

Deploy only `dist/hosted-preview` to a static host. The generated artifact is keyless, does not
load the checkout SDK, performs no payment-network or `/api/demo/*` calls, and does not provide a
field for visitors to enter secret keys.

See [HOSTED_DEMO.md](./HOSTED_DEMO.md) for the deployment boundary.

## Optional local Test-mode adapter smoke

API-backed mode exercises the published Open Border tax and Medusa payment-provider adapters with
Medusa-shaped input. It still does not run Medusa itself or create a Medusa order.

1. Copy the environment template:

   ```bash
   cp .env.example .env
   ```

2. Set `DEMO_MODE=api` and add a Test secret key plus matching Test publishable key. Ask Open
   Border for the currently supported Test API URL.
3. Start the local-only server:

   ```bash
   pnpm start
   ```

The server binds to `127.0.0.1` and rejects live keys. Never deploy this Express server publicly.

## Register the provider in a real Medusa v2 project

Install the public packages:

```bash
npm install @open-border/medusa-payment-openborder @open-border/js
```

Then register the provider in `medusa-config.ts`:

```ts
module.exports = {
  modules: [
    {
      resolve: '@medusajs/medusa/payment',
      options: {
        providers: [
          {
            resolve: '@open-border/medusa-payment-openborder/providers/openborder',
            id: 'openborder',
            options: {
              apiKey: process.env.OPENBORDER_API_KEY,
              baseUrl: process.env.OPENBORDER_API_URL,
            },
          },
        ],
      },
    },
  ],
};
```

The browser uses only the publishable key with `@open-border/js`. The Medusa server keeps the
secret key and sends the quote identifier, payment method, cart-derived line items, customer,
addresses, and a request idempotency key to the provider.

The provider creates a manual-capture payment intent. Medusa remains responsible for deciding
when to capture or cancel it. Persist the Open Border payment-intent ID beside the Medusa payment
or order reference for support and reconciliation.

## Repository map

- `public/` — storefront preview and checkout presentation
- `server.ts` — local preview server and optional Test-mode adapter harness
- `src/demo-catalog.ts` — demo product and market data
- `scripts/build-static-preview.ts` — produces the keyless static artifact
- `scripts/public-safety-check.mjs` — blocks private scopes, internal ticket references, internal
  staging URLs, and committed key-shaped secrets
- `DEMO.md` — short presenter script
- `SECURITY.md` — supported-use and reporting boundaries

## Verification

```bash
pnpm check
```

This runs the public-safety scan, TypeScript checks, and static preview build. CI repeats the same
checks after a clean frozen-lockfile install.

## Current limitations

- This repository demonstrates the checkout presentation and adapter contract, not a full Medusa
  backend/storefront deployment.
- Preview results and IDs are demo-only.
- API-backed mode is local and Test-only.
- Webhook reconciliation and asynchronous order recovery must be implemented by the real Medusa
  application.

## License and demo asset

Open Border has not yet selected an open-source license for this repository. Public visibility
does not grant a redistribution license beyond applicable law and GitHub's terms. The included
product image is demo imagery and contains content-provenance metadata. Contact Open Border before
redistributing the code or asset outside this repository.
