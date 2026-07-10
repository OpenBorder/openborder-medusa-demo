# Hosted preview boundary

The public hosted artifact is a static, keyless preview. It is intentionally separate from the
local API-backed adapter smoke.

## Build

```bash
pnpm install
pnpm build:hosted-preview
```

The output is `dist/hosted-preview` and includes:

- static storefront assets
- generated demo catalog data
- `config.js` forcing preview mode
- no checkout SDK bundle; preview mode does not load payment-network dependencies

## Safe deployment rules

- Deploy only `dist/hosted-preview`.
- Do not deploy `server.ts` or an `.env` file.
- Do not add secret-key inputs to the page.
- Do not include real account, customer, order, payment, or merchant identifiers.
- Keep API-backed and live modes disabled.

## Smoke checks

- All assets load from a project subpath.
- Switching US to UK updates the postal code, GBP quote, tax, duty, total, and routing label.
- Selecting **Pay with Open Border** shows demo-only references.
- The result says **Payment authorized** and **Authorized total**.
- Browser network activity contains no `/api/demo/*` or Open Border API request.
