import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import vm from 'node:vm';

import {
  PRODUCT,
  PREVIEW_CATALOG,
  createDemoCatalogPayload,
  createHostedPreviewPayload,
  createHostedPreviewScript,
} from '../src/demo-catalog';

const EXPECTED_PREVIEW_TITLES = [
  'Global Travel Hoodie',
  'Passport Wallet',
  'Rounding Probe',
  'Transit Packing Cubes',
  'Waypoint Bottle',
];

// Hoodie-only product facts and store promises that must never render for a browse-only listing.
const ADAPTER_ONLY_CHROME = [
  'bag-pill',
  'demo-flow',
  'media-stamp',
  'product-kicker',
  'feature-grid',
  'care-grid',
  'trust-strip',
  'checkout-rail',
  'checkout-heading',
  'destination-step',
  'summary-step',
  'payment-step',
];

const previewOnlyEntries = PREVIEW_CATALOG.filter((entry) => !entry.adapterBacked);

test('the hosted preview payload exposes exactly five entries with unique ids and SKUs', () => {
  const { catalog } = createHostedPreviewPayload();

  assert.equal(catalog.length, 5, 'the public preview must render exactly five catalog entries');
  assert.deepEqual(
    catalog.map((entry) => entry.title).sort(),
    [...EXPECTED_PREVIEW_TITLES].sort(),
  );

  const ids = catalog.map((entry) => entry.id);
  const skus = catalog.map((entry) => entry.sku);
  assert.equal(new Set(ids).size, 5, 'every preview entry needs a unique stable id');
  assert.equal(new Set(skus).size, 5, 'every preview entry needs a unique stable SKU');
  for (const id of ids) assert.match(id, /^prod_medusa_demo_[a-z0-9_]+$/);
  for (const sku of skus) assert.match(sku, /^[A-Z0-9-]{3,}$/);

  assert.deepEqual(catalog, PREVIEW_CATALOG);
  assert.equal(previewOnlyEntries.length, 4, 'four listings must be browse-only');
});

test('the local server payload keeps its original shape and carries no preview catalog', () => {
  const payload = createDemoCatalogPayload();

  assert.deepEqual(Object.keys(payload).sort(), ['markets', 'medusa', 'product']);
  assert.equal('catalog' in payload, false, 'the adapter harness contract must not gain a catalog');
  assert.equal(payload.product, PRODUCT);

  // Only the hosted build may publish the five browse-only listings.
  assert.ok(createHostedPreviewScript().includes('Waypoint Bottle'));
  assert.equal(
    readFileSync(path.resolve('scripts/build-static-preview.ts'), 'utf8').includes(
      'createHostedPreviewScript',
    ),
    true,
    'only the static preview build may consume the hosted payload',
  );
});

test('every preview amount is an explicit integer minor-unit value with a clear currency', () => {
  for (const entry of PREVIEW_CATALOG) {
    assert.ok(
      Number.isSafeInteger(entry.displayAmountMinor),
      `${entry.sku} display amount must be a safe integer minor-unit value`,
    );
    assert.ok(entry.displayAmountMinor > 0, `${entry.sku} display amount must be positive`);
    assert.match(entry.displayCurrency, /^[A-Z]{3}$/, `${entry.sku} needs an explicit currency`);
  }

  // No cross-currency conversion: each entry states one currency and one exact minor amount.
  assert.deepEqual(
    PREVIEW_CATALOG.map((entry) => [entry.sku, entry.displayAmountMinor, entry.displayCurrency]),
    [
      ['GTH-BLK-M', 12_900, 'USD'],
      ['PW-NVY-OS', 4_500, 'USD'],
      ['RP-STD-01', 999, 'USD'],
      ['TPC-GRY-S3', 6_400, 'USD'],
      ['WPB-STL-750', 3_200, 'USD'],
    ],
  );
});

test('the adapter preview amount matches PRODUCT major units times one hundred', () => {
  const adapterBacked = PREVIEW_CATALOG.filter((entry) => entry.adapterBacked);
  assert.equal(adapterBacked.length, 1, 'exactly one preview entry may be adapter-backed');

  const entry = adapterBacked[0];
  const major = PRODUCT.prices[entry.displayCurrency as keyof typeof PRODUCT.prices];
  assert.equal(typeof major, 'number');
  assert.equal(entry.displayAmountMinor, major * 100, 'display minor units must match PRODUCT');
  assert.ok(Number.isSafeInteger(entry.displayAmountMinor));
  assert.ok(Number.isSafeInteger(major * 100));

  assert.equal(entry.sku, PRODUCT.sku);
  assert.equal(entry.id, PRODUCT.medusaProductId);
  assert.equal(entry.hsCode, PRODUCT.hsCode);

  // Pin the unchanged API request contract inputs used by server.ts tax + payment paths.
  assert.equal(PRODUCT.sku, 'GTH-BLK-M');
  assert.equal(PRODUCT.hsCode, '611020');
  assert.equal(PRODUCT.title, 'Global Travel Hoodie');
  assert.equal(PRODUCT.medusaProductId, 'prod_medusa_demo_global_travel_hoodie');
  assert.equal(PRODUCT.medusaVariantId, 'variant_medusa_demo_black_m');
  assert.deepEqual(PRODUCT.prices, { USD: 129, GBP: 99, EUR: 119, CAD: 175, AUD: 199 });
});

test('the hosted public preview renders five items and makes zero API calls', () => {
  const sandbox = runPreviewApp();

  assert.deepEqual(sandbox.fetchCalls, [], 'the public preview must not call any API');
  assert.deepEqual(sandbox.createdScripts, [], 'the public preview must not load the checkout SDK');

  const grid = sandbox.element('catalog-grid').innerHTML;
  for (const entry of PREVIEW_CATALOG) {
    assert.ok(grid.includes(entry.title), `${entry.title} must appear in the public preview`);
    assert.ok(grid.includes(entry.sku), `${entry.sku} must appear in the public preview`);
  }

  // The adapter-backed item keeps its fully simulated local walkthrough.
  assert.ok(sandbox.element('ob-checkout').innerHTML.includes('preview-pay'));
  assert.equal(sandbox.element('catalog').hidden, false);
});

for (const entry of previewOnlyEntries) {
  test(`${entry.title} renders no hoodie facts, promises, or payment controls`, () => {
    const sandbox = runPreviewApp();
    sandbox.selectCatalogItem(entry.id);

    assert.deepEqual(sandbox.fetchCalls, [], 'selecting a preview item must not call any API');

    for (const id of ADAPTER_ONLY_CHROME) {
      assert.equal(
        sandbox.element(id).hidden,
        true,
        `${id} is hoodie-only chrome and must be hidden for ${entry.title}`,
      );
    }

    // No payment control, and the not-purchasable state is visible.
    assert.equal(sandbox.element('ob-checkout').innerHTML, '');
    assert.equal(sandbox.element('preview-only-note').hidden, false);
    assert.match(
      sandbox.element('preview-only-title').textContent,
      /preview only, not purchasable/i,
    );

    // Neutral header and price state rather than a purchasable market price.
    assert.notEqual(sandbox.element('price-label').textContent, 'Market price');
    assert.match(sandbox.element('price-label').textContent, /preview only/i);
    assert.equal(sandbox.element('product-price').textContent, formatExpected(entry));

    // The detail view describes this listing, never the hoodie.
    assert.equal(sandbox.element('product-title').textContent, entry.title);
    assert.equal(sandbox.element('product-description').textContent, entry.description);
    assert.equal(sandbox.element('product-hs').textContent, `HS ${entry.hsCode}`);
    assert.equal(sandbox.element('product-image').hidden, true);
    assert.equal(sandbox.element('product-image-placeholder').hidden, false);
    assert.equal(sandbox.element('quote-state').textContent, '');
  });
}

test('reselecting the adapter-backed item restores the exact hoodie UI', () => {
  const sandbox = runPreviewApp();
  const adapterEntry = PREVIEW_CATALOG.find((entry) => entry.adapterBacked);
  assert.ok(adapterEntry);

  sandbox.selectCatalogItem(previewOnlyEntries[0].id);
  sandbox.selectCatalogItem(adapterEntry.id);

  for (const id of ADAPTER_ONLY_CHROME) {
    assert.equal(sandbox.element(id).hidden, false, `${id} must be restored for the hoodie`);
  }
  assert.equal(sandbox.element('price-label').textContent, 'Market price');
  assert.equal(sandbox.element('preview-only-note').hidden, true);
  assert.equal(sandbox.element('product-image').hidden, false);
  assert.equal(sandbox.element('product-image-placeholder').hidden, true);
  assert.equal(sandbox.element('product-title').textContent, PRODUCT.title);
  assert.equal(sandbox.element('product-media-caption').textContent, 'Charcoal technical shell');
  assert.ok(sandbox.element('ob-checkout').innerHTML.includes('preview-pay'));
  assert.deepEqual(sandbox.fetchCalls, []);
});

test('selection updates cards in place and never rebuilds the catalog DOM', () => {
  const sandbox = runPreviewApp();
  const grid = sandbox.element('catalog-grid');
  const writesAfterRender = grid.innerHTMLWrites;
  assert.equal(writesAfterRender, 1, 'the grid renders exactly once');

  for (const entry of previewOnlyEntries) sandbox.selectCatalogItem(entry.id);
  sandbox.selectCatalogItem(PRODUCT.medusaProductId);

  assert.equal(
    grid.innerHTMLWrites,
    writesAfterRender,
    'selection must not replace the grid markup, which would destroy keyboard focus',
  );

  // Selected state is moved by attribute updates on the existing cards.
  const adapterCard = sandbox.element(`catalog-card-${PRODUCT.medusaProductId}`);
  assert.equal(adapterCard.attributes['aria-pressed'], 'true');
  for (const entry of previewOnlyEntries) {
    assert.equal(sandbox.element(`catalog-card-${entry.id}`).attributes['aria-pressed'], 'false');
  }
});

function formatExpected(entry: (typeof PREVIEW_CATALOG)[number]): string {
  const major = Math.floor(entry.displayAmountMinor / 100);
  const cents = String(entry.displayAmountMinor % 100).padStart(2, '0');
  return `${new Intl.NumberFormat('en').format(major)}.${cents} ${entry.displayCurrency}`;
}

type StubElement = {
  id: string;
  textContent: string;
  value: string;
  hidden: boolean;
  innerHTML: string;
  innerHTMLWrites: number;
  attributes: Record<string, string>;
  classes: Set<string>;
  listeners: Record<string, Array<(event: unknown) => void>>;
  classList: {
    add(name: string): void;
    remove(name: string): void;
    toggle(name: string, force?: boolean): void;
    contains(name: string): boolean;
  };
  setAttribute(name: string, value: string): void;
  getAttribute(name: string): string | null;
  addEventListener(type: string, handler: (event: unknown) => void): void;
  scrollIntoView(): void;
  querySelectorAll(): StubElement[];
};

type PreviewSandbox = {
  fetchCalls: string[];
  createdScripts: string[];
  element: (id: string) => StubElement;
  selectCatalogItem: (id: string) => void;
};

function runPreviewApp(): PreviewSandbox {
  const appSource = readFileSync(path.resolve('public/app.js'), 'utf8');
  const fetchCalls: string[] = [];
  const createdScripts: string[] = [];
  const elements = new Map<string, StubElement>();

  const makeElement = (id: string): StubElement => {
    const node = {
      id,
      textContent: '',
      value: '',
      hidden: false,
      innerHTMLWrites: 0,
      attributes: {} as Record<string, string>,
      classes: new Set<string>(),
      listeners: {} as Record<string, Array<(event: unknown) => void>>,
      setAttribute(name: string, value: string) {
        this.attributes[name] = value;
      },
      getAttribute(name: string) {
        return this.attributes[name] ?? null;
      },
      addEventListener(type: string, handler: (event: unknown) => void) {
        (this.listeners[type] ??= []).push(handler);
      },
      scrollIntoView() {},
      querySelectorAll: () => [] as StubElement[],
    } as unknown as StubElement;

    node.classList = {
      add: (name: string) => void node.classes.add(name),
      remove: (name: string) => void node.classes.delete(name),
      toggle: (name: string, force?: boolean) => {
        const next = force ?? !node.classes.has(name);
        if (next) node.classes.add(name);
        else node.classes.delete(name);
      },
      contains: (name: string) => node.classes.has(name),
    };

    // Counting writes makes "the grid was rebuilt" observable, which is what breaks focus.
    let markup = '';
    Object.defineProperty(node, 'innerHTML', {
      get: () => markup,
      set: (value: string) => {
        markup = String(value);
        node.innerHTMLWrites += 1;
      },
      enumerable: true,
    });

    return node;
  };

  const element = (id: string): StubElement => {
    let found = elements.get(id);
    if (!found) {
      found = makeElement(id);
      elements.set(id, found);
    }
    return found;
  };

  const document = {
    getElementById: (id: string) => element(id),
    createElement: (tag: string) => {
      const created = makeElement(tag);
      if (tag === 'script') createdScripts.push(tag);
      return created;
    },
    head: { appendChild() {} },
    querySelectorAll: () => [] as StubElement[],
    addEventListener() {},
  };

  const context: Record<string, unknown> = {
    document,
    console,
    URLSearchParams,
    Intl,
    Math,
    JSON,
    Number,
    String,
    Object,
    Array,
    Set,
    Promise,
    setTimeout,
    fetch: (input: unknown) => {
      fetchCalls.push(String(input));
      return Promise.reject(new Error('the public preview must not perform network calls'));
    },
    OB_DEMO_CONFIG: { hostedPreview: true, apiBaseUrl: '', publishableKey: '' },
    OB_DEMO_DATA: createHostedPreviewPayload(),
  };
  context.window = {
    location: { search: '' },
    matchMedia: () => ({ matches: false }),
    setTimeout,
    OB_DEMO_CONFIG: context.OB_DEMO_CONFIG,
    OB_DEMO_DATA: context.OB_DEMO_DATA,
  };
  context.globalThis = context;

  vm.createContext(context);
  vm.runInContext(appSource, context, { filename: 'public/app.js' });

  return {
    fetchCalls,
    createdScripts,
    element,
    selectCatalogItem(id: string) {
      const handlers = element('catalog-grid').listeners.click ?? [];
      assert.ok(handlers.length > 0, 'the catalog grid must handle local selection');
      for (const handler of handlers) {
        handler({
          target: {
            closest: (selector: string) =>
              selector === '[data-preview-id]' ? { dataset: { previewId: id } } : null,
          },
        });
      }
    },
  };
}
