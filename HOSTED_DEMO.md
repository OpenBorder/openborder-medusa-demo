# Hosted preview boundary

The public hosted artifact is a static, keyless, **five-product** preview. It is intentionally
separate from the **one-item local adapter harness**.

The hosted artifact is not a complete Medusa backend or store, and it is not proof of a Sandbox
transaction lifecycle. Four of its five listings are browse-only and marked *Preview only — not
purchasable*; the fifth reproduces the simulated authorization walkthrough entirely in the
browser.

## Build

```bash
pnpm install
pnpm build:hosted-preview
```

The output is `dist/hosted-preview` and includes:

- static storefront assets
- generated demo catalog data for all five preview listings, produced by the hosted-only payload
  helper in `src/demo-catalog.ts` and consumed solely by `scripts/build-static-preview.ts`
- `config.js` forcing preview mode with an empty publishable key
- no checkout SDK bundle; preview mode does not load payment-network dependencies

## Safe deployment rules

- Deploy only `dist/hosted-preview`.
- Do not deploy `server.ts` or an `.env` file.
- Do not add secret-key or any other credential inputs to the page.
- Do not add a checkout POST, order submission, or real payment control.
- Do not include real account, customer, order, payment, or merchant identifiers.
- Keep API-backed and live modes disabled.

## Smoke checks

- All assets load from a project subpath.
- The preview catalog shows exactly five listings, each with a unique SKU and an explicit integer
  minor-unit price with its currency.
- Exactly one listing is marked **Adapter-backed**; the other four are marked **Preview only**.
- Selecting a preview-only listing hides the destination, landed-total, and payment steps, and
  shows **Preview only — not purchasable**.
- Selecting a preview-only listing also removes every hoodie-specific claim and store promise:
  the product kicker, feature grid, materials and care, the shipping/returns/guarantee strip, the
  media stamp, the bag count, and the integration-flow and authorization rails.
- The price label for a preview-only listing reads **Preview only · not for sale**, never
  **Market price**.
- Selecting a card updates the existing buttons in place, so keyboard focus stays on the card the
  visitor activated.
- Reselecting the adapter-backed listing restores the full hoodie UI and the simulated
  authorization walkthrough.
- For the adapter-backed listing, switching US to UK updates the postal code, GBP quote, tax,
  duty, total, and routing label.
- Selecting **Pay with Open Border** shows demo-only references from the local simulation.
- The result says **Payment authorized** and **Authorized total**.
- Browser network activity contains only same-origin static assets: no `/api/demo/*` request, no
  Open Border API request, and no checkout POST.
