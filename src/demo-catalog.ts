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

export const DEMO_MEDUSA_CONTEXT = {
  store: 'Open Border Medusa Demo',
  providerId: 'pp_openborder_openborder',
};

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

export function createDemoCatalogScript(): string {
  return `window.OB_DEMO_DATA = ${JSON.stringify(createDemoCatalogPayload())};\n`;
}
