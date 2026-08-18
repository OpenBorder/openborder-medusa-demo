import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { createServer } from 'node:http';
import path from 'node:path';
import { afterEach, test } from 'node:test';

const children: ChildProcess[] = [];

afterEach(async () => {
  await Promise.all(
    children.splice(0).map(
      (child) =>
        new Promise<void>((resolve) => {
          if (child.exitCode !== null) {
            resolve();
            return;
          }
          child.once('exit', () => resolve());
          child.kill('SIGTERM');
        }),
    ),
  );
});

test('API mode publishes the canonical Sandbox origin by default', async () => {
  const port = await availablePort();
  await startDemo(port, {
    OPENBORDER_API_KEY: 'sk_test_x',
    OPENBORDER_PUBLISHABLE_KEY: 'pk_test_x',
  });

  const response = await fetch(`http://127.0.0.1:${port}/config.js`);
  assert.equal(response.status, 200);

  const source = await response.text();
  const match = source.match(/window\.OB_DEMO_CONFIG = (\{.*\});/s);
  assert.ok(match, 'config.js should publish the demo configuration');
  const config = JSON.parse(match[1]) as { apiBaseUrl: string; hostedPreview: boolean };

  assert.equal(config.hostedPreview, false);
  assert.equal(config.apiBaseUrl, 'https://api-sandbox.openborderpayments.com');
});

test('tax quotes use the strict trade-lane contract with exact minor-unit amounts', async () => {
  let receivedBody: unknown;
  const api = createServer(async (request, response) => {
    assert.equal(request.method, 'POST');
    assert.equal(request.url, '/v1/tax_quotes');
    receivedBody = await readJson(request);
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(
      JSON.stringify({
        id: 'tq_route_contract',
        destination_country: 'GB',
        currency: 'GBP',
        amount_breakdown: {
          subtotal: 9_900,
          shipping: 790,
          tax: 1_000,
          duty: 500,
          total: 12_190,
          currency: 'GBP',
        },
        classifications: [{ index: 0, hs_code: '611020', confidence: 1 }],
        expires_at: '2030-01-01T00:00:00.000Z',
      }),
    );
  });
  const apiPort = await listen(api);

  try {
    const demoPort = await availablePort();
    await startDemo(demoPort, {
      OPENBORDER_API_KEY: 'sk_test_x',
      OPENBORDER_API_URL: `http://127.0.0.1:${apiPort}`,
      OPENBORDER_PUBLISHABLE_KEY: 'pk_test_x',
    });

    const response = await fetch(`http://127.0.0.1:${demoPort}/api/demo/tax-quote`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        country: 'GB',
        postal: 'SW1A 1AA',
        email: 'buyer@example.test',
      }),
    });
    const payload = (await response.json()) as { ok?: boolean };

    assert.equal(response.status, 200);
    assert.equal(payload.ok, true);
    assert.deepEqual(receivedBody, {
      destination_country: 'GB',
      ship_from_country: 'US',
      currency: 'GBP',
      shipping_amount: 790,
      line_items: [
        {
          sku: 'GTH-BLK-M',
          description: 'Global Travel Hoodie',
          quantity: 1,
          unit_amount: 9_900,
          hs_code: '611020',
        },
      ],
      customer: { email: 'buyer@example.test' },
    });
  } finally {
    await close(api);
  }
});

test('payment authorization reuses the server-issued quote at the current provider boundary', async () => {
  let receivedPaymentBody: Record<string, unknown> | undefined;
  const breakdown = {
    subtotal: 9_900,
    shipping: 790,
    tax: 1_000,
    duty: 500,
    total: 12_190,
    currency: 'GBP',
  };
  const api = createServer(async (request, response) => {
    const body = (await readJson(request)) as Record<string, unknown>;
    response.writeHead(200, { 'content-type': 'application/json' });
    if (request.url === '/v1/tax_quotes') {
      response.end(
        JSON.stringify({
          id: 'tq_payment_contract',
          destination_country: 'GB',
          currency: 'GBP',
          amount_breakdown: breakdown,
          classifications: [{ index: 0, hs_code: '611020', confidence: 1 }],
          expires_at: '2030-01-01T00:00:00.000Z',
        }),
      );
      return;
    }
    assert.equal(request.url, '/v1/payment_intents');
    receivedPaymentBody = body;
    response.end(
      JSON.stringify({
        id: 'pi_payment_contract',
        status: 'requires_capture',
        client_secret: null,
        entity: 'obmor_uk',
        amount: 9_900,
        amount_captured: 0,
        currency: 'GBP',
        amount_breakdown: breakdown,
      }),
    );
  });
  const apiPort = await listen(api);

  try {
    const demoPort = await availablePort();
    await startDemo(demoPort, {
      OPENBORDER_API_KEY: 'sk_test_x',
      OPENBORDER_API_URL: `http://127.0.0.1:${apiPort}`,
      OPENBORDER_PUBLISHABLE_KEY: 'pk_test_x',
    });

    const quoteResponse = await fetch(`http://127.0.0.1:${demoPort}/api/demo/tax-quote`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        country: 'GB',
        postal: 'SW1A 1AA',
        email: 'buyer@example.test',
      }),
    });
    assert.equal(quoteResponse.status, 200);
    assert.equal(((await quoteResponse.json()) as { ok?: boolean }).ok, true);

    const paymentResponse = await fetch(`http://127.0.0.1:${demoPort}/api/demo/pay`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        country: 'GB',
        postal: 'SW1A 1AA',
        email: 'buyer@example.test',
        paymentMethodId: 'pm_test_route',
        taxQuoteId: 'tq_payment_contract',
      }),
    });
    const paymentPayload = (await paymentResponse.json()) as {
      ok?: boolean;
      paymentIntent?: { status?: string };
    };

    assert.equal(paymentResponse.status, 200);
    assert.equal(paymentPayload.ok, true);
    assert.equal(paymentPayload.paymentIntent?.status, 'requires_capture');
    assert.ok(receivedPaymentBody, 'the provider should create one Test payment intent');
    assert.deepEqual(
      {
        amount: receivedPaymentBody.amount,
        currency: receivedPaymentBody.currency,
        shipping_amount: receivedPaymentBody.shipping_amount,
        tax_quote_id: receivedPaymentBody.tax_quote_id,
        capture_method: receivedPaymentBody.capture_method,
        line_items: receivedPaymentBody.line_items,
      },
      {
        amount: 9_900,
        currency: 'GBP',
        shipping_amount: 790,
        tax_quote_id: 'tq_payment_contract',
        capture_method: 'manual',
        line_items: [
          {
            sku: 'GTH-BLK-M',
            description: 'Global Travel Hoodie',
            quantity: 1,
            unit_amount: 9_900,
            hs_code: '611020',
          },
        ],
      },
    );
  } finally {
    await close(api);
  }
});

test('the demo product route keeps the one-item harness shape, with no catalog', async () => {
  const port = await availablePort();
  await startDemo(port, {
    OPENBORDER_API_KEY: 'sk_test_x',
    OPENBORDER_PUBLISHABLE_KEY: 'pk_test_x',
  });

  const response = await fetch(`http://127.0.0.1:${port}/api/demo/product`);
  assert.equal(response.status, 200);
  const payload = (await response.json()) as Record<string, unknown> & {
    product?: { sku?: string };
  };

  assert.deepEqual(Object.keys(payload).sort(), ['markets', 'medusa', 'product']);
  assert.equal('catalog' in payload, false, 'the adapter harness route must not serve a catalog');
  assert.equal(payload.product?.sku, 'GTH-BLK-M');

  const demoData = await (await fetch(`http://127.0.0.1:${port}/demo-data.js`)).text();
  assert.equal(demoData.includes('catalog'), false, 'served demo data must carry no catalog');
  assert.equal(demoData.includes('Waypoint Bottle'), false);
  assert.equal(demoData.includes('Passport Wallet'), false);
});

async function availablePort(): Promise<number> {
  const server = createServer();
  const port = await listen(server);
  await close(server);
  return port;
}

async function listen(server: ReturnType<typeof createServer>): Promise<number> {
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve());
  });
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  return address.port;
}

async function close(server: ReturnType<typeof createServer>): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

async function readJson(request: NodeJS.ReadableStream): Promise<unknown> {
  let body = '';
  for await (const chunk of request) {
    body += String(chunk);
  }
  return JSON.parse(body);
}

async function startDemo(port: number, extraEnv: NodeJS.ProcessEnv): Promise<void> {
  const child = spawn(path.resolve('node_modules/.bin/tsx'), ['server.ts'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      DEMO_MODE: 'api',
      PORT: String(port),
      ...extraEnv,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  children.push(child);

  let stderr = '';
  child.stderr?.on('data', (chunk) => {
    stderr += String(chunk);
  });

  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`demo server exited before readiness: ${stderr}`);
    }
    try {
      const response = await fetch(`http://127.0.0.1:${port}/config.js`);
      if (response.ok) return;
    } catch {
      // The server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(`demo server did not become ready: ${stderr}`);
}
