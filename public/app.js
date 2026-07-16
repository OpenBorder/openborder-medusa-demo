/* global OpenBorder, OB_DEMO_CONFIG, OB_DEMO_DATA, document, window */
const state = {
  product: null,
  markets: null,
  country: 'US',
  quote: null,
  checkout: null,
  mounted: null,
  isPaying: false,
};
const search = new URLSearchParams(window.location.search);
const PREVIEW_MODE = search.get('preview') === '1' || OB_DEMO_CONFIG.hostedPreview === true;
const AUTO_RECEIPT = search.get('receipt') === '1';

const $ = (id) => document.getElementById(id);
const moneyMajor = (amount, currency) =>
  new Intl.NumberFormat('en', { style: 'currency', currency }).format(amount);
const moneyMinor = (amount, currency) =>
  new Intl.NumberFormat('en', { style: 'currency', currency }).format(amount / 100);
const majorToMinor = (amount) => Math.round(amount * 100);

init().catch((error) => {
  setQuoteState(error.message || 'Demo failed to initialize.', true);
});

async function init() {
  const data = PREVIEW_MODE ? OB_DEMO_DATA : await loadProductFromDemoApi();
  state.product = data.product;
  state.markets = data.markets;
  if (!PREVIEW_MODE) {
    await loadOpenBorderBundle();
  }
  wireEvents();
  renderMarket();
  await refreshQuote();
}

async function loadOpenBorderBundle() {
  if (window.OpenBorder) return;
  await new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = './openborder.global.js';
    script.onload = resolve;
    script.onerror = () => reject(new Error('Open Border checkout bundle failed to load.'));
    document.head.appendChild(script);
  });
}

async function loadProductFromDemoApi() {
  const res = await fetch('/api/demo/product');
  if (!res.ok) {
    throw new Error(`Product load failed: ${res.status}`);
  }
  return res.json();
}

function wireEvents() {
  $('market-select').addEventListener('change', async (event) => {
    const nextCountry = event.target.value;
    if (nextCountry === state.country) return;

    state.country = nextCountry;
    renderMarket({ resetPostal: true });
    await refreshQuote();
  });
  $('postal').addEventListener('change', refreshQuote);
  $('email').addEventListener('change', refreshQuote);
  $('receipt-reset').addEventListener('click', resetAuthorizationDemo);
}

function market() {
  return state.markets[state.country];
}

function renderMarket(options = {}) {
  const current = market();
  const subtotal = state.product.prices[current.currency];
  const subtotalMinor = majorToMinor(subtotal);
  const shippingMinor = majorToMinor(current.shipping);

  $('market-select').value = state.country;
  if (options.resetPostal || !$('postal').value.trim()) {
    $('postal').value = current.postal;
  }
  $('product-price').textContent = `${moneyMajor(subtotal, current.currency)} ${current.currency}`;
  $('subtotal').textContent = moneyMajor(subtotal, current.currency);
  $('shipping').textContent = moneyMajor(current.shipping, current.currency);
  $('shipping-price').textContent = moneyMajor(current.shipping, current.currency);
  $('entity-route').textContent = `${current.currency} → ${current.entityHint}`;
  renderTotal({
    subtotal: subtotalMinor,
    shipping: shippingMinor,
    tax: 0,
    duty: 0,
    total: subtotalMinor + shippingMinor,
    currency: current.currency,
  });
}

async function refreshQuote() {
  const current = market();
  state.quote = null;
  clearReceipt();
  setQuoteState('Calculating tax and duty with Open Border.', false);
  $('tax').textContent = 'Calculating';
  $('duty').textContent = 'Calculating';
  unmountPayment();

  if (PREVIEW_MODE) {
    const subtotalMinor = majorToMinor(state.product.prices[current.currency]);
    const shippingMinor = majorToMinor(current.shipping);
    state.quote = {
      tax_quote_id: 'tq_demo_presentable',
      amount_breakdown: {
        subtotal: subtotalMinor,
        shipping: shippingMinor,
        tax: Math.round(subtotalMinor * 0.069),
        duty: Math.round(subtotalMinor * 0.097),
        total:
          subtotalMinor +
          shippingMinor +
          Math.round(subtotalMinor * 0.069) +
          Math.round(subtotalMinor * 0.097),
        currency: current.currency,
      },
    };
    renderTotal(state.quote.amount_breakdown);
    setQuoteState(`Tax quote ${state.quote.tax_quote_id} is ready.`, false);
    mountPayment();
    return;
  }

  try {
    const res = await fetch('/api/demo/tax-quote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        country: state.country,
        postal: $('postal').value.trim() || current.postal,
        email: $('email').value.trim(),
      }),
    });
    const data = await res.json();
    if (!data.ok) {
      throw new Error(`${data.code}: ${data.message}`);
    }
    state.quote = data.quote;
    renderTotal(data.quote.amount_breakdown);
    setQuoteState(`Tax quote ${data.quote.tax_quote_id} is ready.`, false);
    mountPayment();
  } catch (error) {
    setQuoteState(error.message || 'Tax quote failed. Checkout is blocked.', true);
    $('tax').textContent = 'Blocked';
    $('duty').textContent = 'Blocked';
  }
}

function renderTotal(breakdown) {
  $('tax').textContent = moneyMinor(breakdown.tax, breakdown.currency);
  $('duty').textContent = moneyMinor(breakdown.duty, breakdown.currency);
  $('total').textContent =
    `${moneyMinor(breakdown.total, breakdown.currency)} ${breakdown.currency}`;
}

function mountPayment() {
  if (!state.quote) {
    return;
  }

  if (PREVIEW_MODE) {
    $('ob-checkout').innerHTML =
      '<div class="preview-card-form">' +
      '<div class="preview-card-row"><span>Card number</span><b>4242 4242 4242 4242</b></div>' +
      '<div class="preview-card-row split"><span>MM / YY</span><span>CVC</span></div>' +
      `<button id="preview-pay" type="button">${paymentSubmitLabel()}</button>` +
      '</div>';
    $('preview-pay').addEventListener('click', () => {
      showReceipt({
        medusa: {
          orderId: 'demo_order_01J2W4X8G5K1M6Q9Z0Y7',
          providerId: 'pp_openborder_openborder',
          productId: state.product.medusaProductId,
        },
        paymentIntent: {
          id: 'demo_pi_01HY9N8K3T6QZ4J7D2P5',
          status: 'requires_capture',
          entity: market().entityHint,
        },
        amountBreakdown: state.quote.amount_breakdown,
      });
      setQuoteState(
        'Payment authorized. Open Border returned a manual-capture payment intent.',
        false,
      );
    });
    if (AUTO_RECEIPT) {
      window.setTimeout(() => $('preview-pay').click(), 100);
    }
    return;
  }

  if (!window.OpenBorder) {
    $('ob-checkout').innerHTML =
      '<div class="payment-unavailable">Open Border payment element is unavailable.</div>';
    return;
  }

  const current = market();
  const ob = OpenBorder(OB_DEMO_CONFIG.publishableKey, {
    apiBaseUrl: OB_DEMO_CONFIG.apiBaseUrl,
  });

  state.mounted = ob.mount('#ob-checkout', {
    currency: current.currency,
    amount: state.quote.amount_breakdown.total,
    submitLabel: paymentSubmitLabel(),
    billingDetails: {
      email: $('email').value.trim(),
      address: {
        postal_code: $('postal').value.trim() || current.postal,
        country: state.country,
      },
    },
    onSuccess: ({ paymentMethodId }) => submitPayment(paymentMethodId),
    onError: (message) => setQuoteState(message, true),
  });
}

function paymentSubmitLabel() {
  if (!state.quote) return '';
  const amount = `${moneyMinor(state.quote.amount_breakdown.total, state.quote.amount_breakdown.currency)} ${
    state.quote.amount_breakdown.currency
  }`;
  return window.matchMedia('(max-width: 720px)').matches
    ? 'Pay with Open Border'
    : `Pay with Open Border · ${amount}`;
}

function unmountPayment() {
  if (state.mounted) {
    state.mounted.unmount();
    state.mounted = null;
  }
  $('ob-checkout').innerHTML = '';
}

async function submitPayment(paymentMethodId) {
  if (state.isPaying || !state.quote) return;
  state.isPaying = true;
  setQuoteState('Preparing Medusa order and Open Border payment intent.', false);

  try {
    const res = await fetch('/api/demo/pay', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        country: state.country,
        postal: $('postal').value.trim() || market().postal,
        email: $('email').value.trim(),
        paymentMethodId,
        taxQuoteId: state.quote.tax_quote_id,
      }),
    });
    const data = await res.json();
    if (!data.ok) {
      throw new Error(`${data.code}: ${data.message}`);
    }
    showReceipt(data);
    setQuoteState(
      'Payment authorized. Open Border returned a manual-capture payment intent.',
      false,
    );
  } catch (error) {
    setQuoteState(error.message || 'Payment failed.', true);
  } finally {
    state.isPaying = false;
  }
}

function showReceipt(data) {
  const breakdown = data.amountBreakdown || state.quote.amount_breakdown;
  $('receipt-order').textContent = data.medusa.orderId;
  $('receipt-intent').textContent = data.paymentIntent.id;
  $('receipt-entity').textContent = String(data.paymentIntent.entity);
  $('receipt-total').textContent = `${moneyMinor(breakdown.total, breakdown.currency)} ${
    breakdown.currency
  }`;
  $('receipt-details').textContent = JSON.stringify(
    {
      medusa_provider_id: data.medusa.providerId,
      medusa_product_id: data.medusa.productId,
      openborder_status: data.paymentIntent.status,
      amount_breakdown: breakdown,
    },
    null,
    2,
  );
  $('payment-box').hidden = true;
  $('payment-step').classList.add('is-authorized');
  $('payment-heading').textContent = 'Authorization complete';
  $('payment-description').textContent = 'Open Border returned proof to Medusa.';
  $('receipt-card').hidden = false;
  $('receipt-card').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function clearReceipt() {
  $('receipt-card').hidden = true;
  $('payment-box').hidden = false;
  $('payment-step').classList.remove('is-authorized');
  $('payment-heading').textContent = 'Authorize payment';
  $('payment-description').textContent = 'Encrypted by Open Border. Card data never enters Medusa.';
}

function resetAuthorizationDemo() {
  clearReceipt();
  unmountPayment();
  mountPayment();
  setQuoteState(`Tax quote ${state.quote.tax_quote_id} is ready.`, false);
  $('payment-step').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function setQuoteState(message, isError) {
  const el = $('quote-state');
  el.textContent = message;
  el.classList.toggle('error', Boolean(isError));
}
