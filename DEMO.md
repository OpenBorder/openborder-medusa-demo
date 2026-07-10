# Presenter script

## Start

```bash
pnpm install
pnpm start
```

Open <http://127.0.0.1:8000>.

## Walkthrough

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

## Important wording

- Say **authorized**, not paid or captured.
- Say **demo order reference**, not real Medusa order.
- Preview mode is keyless and does not call Open Border APIs.
- API-backed mode is a local Test-mode adapter smoke, not a public deployment.
