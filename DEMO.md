# Presenter script

## What this demo is

- A **five-product keyless preview**, in the hosted static build: five fictional catalog
  listings, browsable and selectable entirely in the browser.
- A **one-item local adapter harness**, in the Express server: only the Global Travel Hoodie
  exists there, and it reaches the Open Border adapters only in optional Test mode.

## What this demo is not

- Not a complete Medusa backend or store. No Medusa server, no real cart, no real order.
- Not proof of a Sandbox transaction lifecycle. Nothing captures, refunds, settles, or reconciles.
- Not a purchasable catalog. Four of the five listings are marked *Preview only — not purchasable*.

## Recommended presentation order

Start with the keyless preview. Only continue to the connected Test-mode section when you want to
show real Test-rail activity.

## Start the keyless preview

```bash
git clone https://github.com/OpenBorder/openborder-medusa-demo.git
cd openborder-medusa-demo
corepack enable
pnpm install --frozen-lockfile
pnpm start
```

Open <http://127.0.0.1:8000>.

## Keyless walkthrough

`pnpm start` serves the one-item harness, so these steps cover the Global Travel Hoodie only. To
present the five-product catalog, build the hosted preview and serve `dist/hosted-preview`.

1. Show the **Global Travel Hoodie**.
2. Say: “Medusa owns the storefront and order flow. Open Border provides tax, duty, payment
   authorization, and routing.”
3. Change the market from United States to United Kingdom.
4. Point to the updated postal code, GBP amount, tax, duty, total, and UK routing label.
5. Select **Pay with Open Border**. Say that this preview step is simulated locally.
6. Show the demo order reference, demo payment-intent reference, routing label, and authorized
   total.
7. Say: “This preview stops at a simulated authorization. A real Medusa application decides when
   to capture or cancel the payment.”

## Hosted five-product catalog walkthrough

1. Run `pnpm build:hosted-preview` and serve `dist/hosted-preview`.
2. Show the **Preview catalog**: five fictional listings, each with a stable SKU and an explicit
   integer minor-unit price in a stated currency.
3. Select **Passport Wallet**. Point out that the hoodie's features, materials, care, shipping and
   returns promises, bag count, and the whole checkout and authorization flow all disappear, and
   the price reads **Preview only · not for sale**.
4. Say: “Only one listing is wired to the adapter harness. The other four are catalog data.”
5. Reselect the **Global Travel Hoodie**, marked **Adapter-backed**, and show the full simulated
   walkthrough returning intact.

## Optional connected Test walkthrough

1. Open <https://app.openborderpayments.com/developers> and confirm the dashboard environment is
   **Sandbox**.
2. Go to **Developers → API keys**.
3. Create a **Sandbox Test** key named `Medusa standup demo`.
4. Copy the one-time secret key and its matching publishable key. Do not show or share the secret.
5. Run `cp .env.example .env`, set `DEMO_MODE=api`, and add both Test keys to `.env`.
6. Restart `pnpm start` and reopen <http://127.0.0.1:8000>.
7. Select United Kingdom and pay with Test card `4242 4242 4242 4242`, any future expiry, and any
   valid three-digit CVC.
8. Show the authorization receipt, then optionally find the reference under dashboard
   **Transactions**.
9. Say: “This uses Test rails, so no real money moves.”
10. After the presentation, stop the server and revoke the demo key if it is no longer needed.

## Important wording

- Say **authorized**, not paid or captured.
- Say **demo order reference**, not real Medusa order.
- Say **preview only** for the four browse-only listings. Never imply they can be bought.
- The five-product catalog exists only in the hosted static build, never in the local server.
- Preview mode is keyless, is simulated locally, and does not call Open Border APIs.
- API-backed mode is a one-item local Test-mode adapter smoke, not a public deployment and not a
  Sandbox lifecycle proof.
- Never show `.env`, use Production credentials, or say that the preview creates a real Medusa
  order.
