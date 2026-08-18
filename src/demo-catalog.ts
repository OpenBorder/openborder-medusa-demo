import type { Currency } from '@open-border/node';

export type CountryCode = 'US' | 'GB' | 'DE' | 'CA' | 'AU';

export const MARKETS: Record<
  CountryCode,
  {
    label: string;
    currency: Currency;
    postal: string;
    entityHint: string;
    /** Major-unit shipping amount, matching the Medusa payment-provider boundary. */
    shipping: number;
  }
> = {
  US: {
    label: 'United States',
    currency: 'USD',
    postal: '10001',
    entityHint: 'US entity',
    shipping: 9.9,
  },
  GB: {
    label: 'United Kingdom',
    currency: 'GBP',
    postal: 'SW1A 1AA',
    entityHint: 'UK entity',
    shipping: 7.9,
  },
  DE: {
    label: 'Germany',
    currency: 'EUR',
    postal: '10115',
    entityHint: 'EU entity',
    shipping: 8.9,
  },
  CA: {
    label: 'Canada',
    currency: 'CAD',
    postal: 'M5V 2T6',
    entityHint: 'Canada entity',
    shipping: 12.9,
  },
  AU: {
    label: 'Australia',
    currency: 'AUD',
    postal: '2000',
    entityHint: 'Australia entity',
    shipping: 14.9,
  },
};

export const PRODUCT = {
  medusaProductId: 'prod_medusa_demo_global_travel_hoodie',
  medusaVariantId: 'variant_medusa_demo_black_m',
  sku: 'GTH-BLK-M',
  title: 'Global Travel Hoodie',
  description:
    'Technical hoodie built for movement. Lightweight, breathable, and water-repellent for every journey.',
  hsCode: '611020',
  /** Major-unit catalog prices, matching the Medusa payment-provider boundary. */
  prices: {
    USD: 129,
    GBP: 99,
    EUR: 119,
    CAD: 175,
    AUD: 199,
  } satisfies Record<Currency, number>,
};

/**
 * A public preview catalog entry.
 *
 * Display amounts are explicit integer minor units paired with one explicit currency. The
 * preview never converts between currencies and never performs floating-point money math.
 */
export type PreviewCatalogEntry = {
  id: string;
  sku: string;
  title: string;
  description: string;
  hsCode: string;
  /** Exact integer minor-unit display amount, e.g. 12_900 for 129.00. */
  displayAmountMinor: number;
  /** The single currency this display amount is stated in. */
  displayCurrency: Currency;
  /**
   * True only for the one item wired to the local Test-mode adapter harness. Every other entry
   * is a fictional browse-only listing with no quote, checkout, or payment path.
   */
  adapterBacked: boolean;
};

/**
 * The five fictional listings rendered by the keyless public preview.
 *
 * Only PRODUCT is adapter-backed; the other four exist to show catalog browsing and must never
 * imply that they are purchasable.
 */
export const PREVIEW_CATALOG: readonly PreviewCatalogEntry[] = [
  {
    id: PRODUCT.medusaProductId,
    sku: PRODUCT.sku,
    title: PRODUCT.title,
    description:
      'A packable technical layer built for changing terminals, climates, and time zones.',
    hsCode: PRODUCT.hsCode,
    displayAmountMinor: 12_900,
    displayCurrency: 'USD',
    adapterBacked: true,
  },
  {
    id: 'prod_medusa_demo_passport_wallet',
    sku: 'PW-NVY-OS',
    title: 'Passport Wallet',
    description: 'Slim document sleeve with RFID-blocking lining and a boarding-pass pocket.',
    hsCode: '420231',
    displayAmountMinor: 4_500,
    displayCurrency: 'USD',
    adapterBacked: false,
  },
  {
    id: 'prod_medusa_demo_rounding_probe',
    sku: 'RP-STD-01',
    title: 'Rounding Probe',
    description: 'Deliberately odd 9.99 listing that keeps minor-unit rounding visible.',
    hsCode: '901580',
    displayAmountMinor: 999,
    displayCurrency: 'USD',
    adapterBacked: false,
  },
  {
    id: 'prod_medusa_demo_transit_packing_cubes',
    sku: 'TPC-GRY-S3',
    title: 'Transit Packing Cubes',
    description: 'Three-piece compression set that keeps a carry-on sorted across connections.',
    hsCode: '420292',
    displayAmountMinor: 6_400,
    displayCurrency: 'USD',
    adapterBacked: false,
  },
  {
    id: 'prod_medusa_demo_waypoint_bottle',
    sku: 'WPB-STL-750',
    title: 'Waypoint Bottle',
    description: 'Insulated 750 ml steel bottle sized for long-haul cabin and trail use.',
    hsCode: '961700',
    displayAmountMinor: 3_200,
    displayCurrency: 'USD',
    adapterBacked: false,
  },
];

export const DEMO_MEDUSA_CONTEXT = {
  store: 'Open Border Medusa Demo',
  providerId: 'pp_openborder_openborder',
};

/**
 * The local server payload for `/api/demo/product` and `/demo-data.js`.
 *
 * This shape is the local adapter harness contract and intentionally carries no preview catalog:
 * the harness covers exactly one item, PRODUCT.
 */
export function createDemoCatalogPayload(): {
  product: typeof PRODUCT;
  markets: typeof MARKETS;
  medusa: typeof DEMO_MEDUSA_CONTEXT;
} {
  return {
    product: PRODUCT,
    markets: MARKETS,
    medusa: DEMO_MEDUSA_CONTEXT,
  };
}

/**
 * The hosted static preview payload. Consumed only by scripts/build-static-preview.ts, never by
 * the local server, so the five browse-only listings cannot reach an API-backed code path.
 */
export function createHostedPreviewPayload(): {
  product: typeof PRODUCT;
  catalog: readonly PreviewCatalogEntry[];
  markets: typeof MARKETS;
  medusa: typeof DEMO_MEDUSA_CONTEXT;
} {
  return {
    product: PRODUCT,
    catalog: PREVIEW_CATALOG,
    markets: MARKETS,
    medusa: DEMO_MEDUSA_CONTEXT,
  };
}

export function createHostedPreviewScript(): string {
  return `window.OB_DEMO_DATA = ${JSON.stringify(createHostedPreviewPayload())};\n`;
}

export function createDemoCatalogScript(): string {
  return `window.OB_DEMO_DATA = ${JSON.stringify(createDemoCatalogPayload())};\n`;
}
