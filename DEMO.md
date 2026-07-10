# Presenter script

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

1. Show the **Global Travel Hoodie**.
2. Say: “Medusa owns the storefront and order flow. Open Border provides tax, duty, payment
   authorization, and routing.”
3. Change the market from United States to United Kingdom.
4. Point to the updated postal code, GBP amount, tax, duty, total, and UK routing label.
5. Select **Pay with Open Border**.
6. Show the demo order reference, demo payment-intent reference, routing label, and authorized
   total.
7. Say: “This preview stops at authorization. A real Medusa application decides when to capture
   or cancel the payment.”

## Optional connected Test walkthrough

1. Open <https://staging.openborderpayments.com/> and confirm the dashboard environment is
   **Test**.
2. Go to **Developers → API keys**.
3. Create a **Test** key named `Medusa standup demo`.
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
- Preview mode is keyless and does not call Open Border APIs.
- API-backed mode is a local Test-mode adapter smoke, not a public deployment.
- Never show `.env`, use Production credentials, or say that the preview creates a real Medusa
  order.
