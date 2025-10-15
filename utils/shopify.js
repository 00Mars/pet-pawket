// utils/shopify.js — minimal Storefront fetch with timeout + retry (Node 20)
const SF_DOMAIN  = process.env.SHOPIFY_STOREFRONT_DOMAIN || 'yx0ksi-xv.myshopify.com';
const SF_VERSION = process.env.SHOPIFY_API_VERSION || '2024-07';
const SF_TOKEN   = process.env.SHOPIFY_STOREFRONT_TOKEN;

if (!SF_TOKEN) {
  console.warn('[shopify] Missing SHOPIFY_STOREFRONT_TOKEN — requests will fail.');
}

/**
 * storefrontFetch(query, variables?, { timeoutMs, retries })
 * - Timeouts at timeoutMs (default 7000)
 * - Retries network/timeouts with expo backoff (default 2)
 */
export async function storefrontFetch(query, variables = {}, opts = {}) {
  const { timeoutMs = 7000, retries = 2 } = opts;

  const url = `https://${SF_DOMAIN}/api/${SF_VERSION}/graphql.json`;
  const body = JSON.stringify({ query, variables });

  let attempt = 0;
  while (true) {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-Shopify-Storefront-Access-Token': SF_TOKEN || '',
        },
        body,
        signal: controller.signal,
      });
      clearTimeout(t);

      if (!res.ok) {
        // Non-200s are not retried (bubble up with details)
        const text = await res.text().catch(() => '');
        throw Object.assign(new Error(`[shopify] HTTP ${res.status}: ${text.slice(0,200)}`), { status: res.status });
      }

      const json = await res.json();
      if (json.errors) {
        // GraphQL errors (don’t retry)
        throw Object.assign(new Error('[shopify] GraphQL errors'), { graphqlErrors: json.errors });
      }
      return json.data;
    } catch (err) {
      clearTimeout(t);
      const isAbort = err?.name === 'AbortError';
      const isNet = err?.code === 'ETIMEDOUT' || err?.type === 'system' || isAbort;

      if (isNet && attempt < retries) {
        attempt += 1;
        const backoff = 300 * Math.pow(2, attempt); // 600ms, 1200ms...
        await new Promise(r => setTimeout(r, backoff));
        continue;
      }
      throw err;
    }
  }
}