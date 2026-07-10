import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import express from 'express';
import { OpenBorderApiError, type AmountBreakdown, type Currency } from '@open-border/node';
import {
  createOpenBorderApiClient,
  OpenBorderMedusaPaymentProviderService,
  OpenBorderTaxProvider,
} from '@open-border/medusa-payment-openborder';
import {
  MARKETS,
  PRODUCT,
  type CountryCode,
  createDemoCatalogPayload,
  createDemoCatalogScript,
} from './src/demo-catalog';

const PORT = Number(process.env.PORT ?? 8000);
const HOST = '127.0.0.1';
const DEMO_MODE = process.env.DEMO_MODE === 'api' ? 'api' : 'preview';
const OPENBORDER_ELEMENT_BUNDLE = path.join(
  __dirname,
  'node_modules/@open-border/js/dist/openborder.global.js',
);

const integration = DEMO_MODE === 'api' ? createTestIntegration() : null;

const app = express();
app.use(express.json());

app.get('/config.js', (_req, res) => {
  res.type('application/javascript').send(
    `window.OB_DEMO_CONFIG = ${JSON.stringify({
      hostedPreview: DEMO_MODE === 'preview',
      apiBaseUrl: integration?.apiUrl ?? '',
      publishableKey: integration?.publishableKey ?? '',
    })};`,
  );
});

app.get('/demo-data.js', (_req, res) => {
  res.type('application/javascript').send(createDemoCatalogScript());
});

app.get('/openborder.global.js', (_req, res) => {
  res.sendFile(OPENBORDER_ELEMENT_BUNDLE, (error) => {
    if (!error || res.headersSent) {
      return;
    }

    res
      .status(503)
      .type('application/javascript')
      .send(
        'console.error("Open Border payment element bundle is missing. Run `pnpm install` before starting the demo.");',
      );
  });
});

app.get('/api/demo/product', (_req, res) => {
  res.json(createDemoCatalogPayload());
});

app.post('/api/demo/checkout-config', async (req, res) => {
  const clients = requireTestIntegration(res);
  if (!clients) return;
  const market = marketFromBody(req.body);
  try {
    const config = await clients.openBorder.getCheckoutConfig({ currency: market.currency });
    res.json({ ok: true, config });
  } catch (error) {
    sendApiError(res, error, 'checkout_config_failed');
  }
});

app.post('/api/demo/tax-quote', async (req, res) => {
  const clients = requireTestIntegration(res);
  if (!clients) return;
  const body = req.body ?? {};
  const market = marketFromBody(body);
  const subtotal = majorToMinor(PRODUCT.prices[market.currency]);

  try {
    const quote = await clients.taxProvider.getTaxLines(
      [
        {
          sku: PRODUCT.sku,
          description: PRODUCT.title,
          quantity: 1,
          unit_amount: subtotal,
          hs_code: PRODUCT.hsCode,
        },
      ],
      {
        destination_country: body.country ?? 'US',
        destination_postal_code: String(body.postal ?? market.postal),
        currency: market.currency,
        shipping_amount: majorToMinor(market.shipping),
        customer: body.email ? { email: String(body.email) } : undefined,
      },
    );

    res.json({
      ok: true,
      quote,
      medusaCartId: demoCartId(market.currency),
    });
  } catch (error) {
    sendApiError(res, error, 'tax_quote_failed');
  }
});

app.post('/api/demo/pay', async (req, res) => {
  const clients = requireTestIntegration(res);
  if (!clients) return;
  const body = req.body ?? {};
  const market = marketFromBody(body);
  const subtotal = PRODUCT.prices[market.currency];
  const subtotalMinor = majorToMinor(subtotal);
  const shippingMinor = majorToMinor(market.shipping);
  const orderDraftId = `medusa-demo-${randomUUID()}`;
  const paymentMethodId = stringField(body.paymentMethodId, 'paymentMethodId');
  const email = stringField(body.email, 'email');
  const postal = String(body.postal ?? market.postal);
  const country = String(body.country ?? 'US').toUpperCase();

  try {
    const result = await clients.paymentProvider.initiatePayment({
      amount: subtotal,
      currency_code: market.currency.toLowerCase(),
      data: {
        payment_method: paymentMethodId,
        openborder_tax_quote_id: stringField(body.taxQuoteId, 'taxQuoteId'),
        shipping_amount: shippingMinor,
        customer: {
          email,
          name: String(body.name ?? 'Demo Buyer'),
        },
        billing_address: {
          line1: String(body.addressLine1 ?? '55 Hudson Yards'),
          city: String(body.city ?? 'New York'),
          postal_code: postal,
          country,
        },
        shipping_address: {
          line1: String(body.addressLine1 ?? '55 Hudson Yards'),
          city: String(body.city ?? 'New York'),
          postal_code: postal,
          country,
        },
        line_items: [
          {
            sku: PRODUCT.sku,
            description: PRODUCT.title,
            quantity: 1,
            unit_amount: subtotalMinor,
            hs_code: PRODUCT.hsCode,
          },
        ],
        merchant_reference: orderDraftId,
        metadata: {
          source: 'medusa-demo',
          medusa_product_id: PRODUCT.medusaProductId,
          medusa_variant_id: PRODUCT.medusaVariantId,
        },
      },
      context: {
        idempotency_key: `medusa-demo-${randomUUID()}`,
        customer: {
          id: 'cus_medusa_demo',
          email,
        },
      },
    });

    const data = result.data ?? {};
    res.json({
      ok: true,
      medusa: {
        orderId: `demo_order_draft_${randomUUID().replaceAll('-', '').slice(0, 12)}`,
        providerId: 'pp_openborder_openborder',
        productId: PRODUCT.medusaProductId,
      },
      paymentIntent: {
        id: String(data.openborder_payment_intent_id ?? result.id),
        status: String(data.openborder_status ?? result.status),
        entity: data.entity,
      },
      amountBreakdown: data.amount_breakdown as AmountBreakdown | undefined,
    });
  } catch (error) {
    sendApiError(res, error, 'payment_failed');
  }
});

app.use(express.static(path.join(__dirname, 'public')));

app.listen(PORT, HOST, () => {
  console.log(`Open Border Medusa demo on http://${HOST}:${PORT}`);
  console.log(`  Mode: ${DEMO_MODE}`);
  console.log(`  Payment provider: pp_openborder_openborder`);
});

function createTestIntegration() {
  const apiKey = requiredTestKey('OPENBORDER_API_KEY', 'sk_test_', process.env.OPENBORDER_API_KEY);
  const publishableKey = requiredTestKey(
    'OPENBORDER_PUBLISHABLE_KEY',
    'pk_test_',
    process.env.OPENBORDER_PUBLISHABLE_KEY,
  );
  const apiUrl = process.env.OPENBORDER_API_URL?.trim() || undefined;
  const openBorder = createOpenBorderApiClient({ apiKey, baseUrl: apiUrl });
  const taxProvider = new OpenBorderTaxProvider(openBorder);
  const paymentProvider = new OpenBorderMedusaPaymentProviderService(
    {},
    { apiKey, baseUrl: apiUrl },
  );

  return { apiUrl, openBorder, paymentProvider, publishableKey, taxProvider };
}

function requiredTestKey(name: string, prefix: string, value: string | undefined): string {
  const key = value?.trim();
  if (!key || !key.startsWith(prefix)) {
    throw new Error(`${name} must be a ${prefix}... key when DEMO_MODE=api.`);
  }
  return key;
}

function requireTestIntegration(res: express.Response): NonNullable<typeof integration> | null {
  if (integration) return integration;
  res.status(409).json({
    ok: false,
    code: 'preview_mode_only',
    message: 'API-backed routes are disabled. Set DEMO_MODE=api with Test keys for local smoke.',
  });
  return null;
}

function marketFromBody(body: unknown): (typeof MARKETS)[CountryCode] {
  const requestedCountry =
    typeof body === 'object' && body
      ? String((body as { country?: unknown }).country ?? 'US').toUpperCase()
      : 'US';
  return MARKETS[requestedCountry as CountryCode] ?? MARKETS.US;
}
function demoCartId(currency: Currency): string {
  return `cart_medusa_demo_${currency.toLowerCase()}`;
}

function majorToMinor(amount: number): number {
  return Math.round(amount * 100);
}

function stringField(value: unknown, field: string): string {
  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }
  throw new Error(`${field} is required`);
}

function sendApiError(res: express.Response, error: unknown, code: string): void {
  console.error(`[openborder-medusa-demo] ${code}`, error);
  if (error instanceof OpenBorderApiError) {
    res.status(error.status || 502).json({
      ok: false,
      code: error.code,
      message: 'Open Border rejected the Test-mode demo request.',
    });
    return;
  }
  res.status(500).json({
    ok: false,
    code,
    message: 'The Test-mode demo request failed. Check the local server log.',
  });
}
