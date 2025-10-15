// routes/productsRoutes.js
// Products proxy against Shopify Storefront (no client token exposure).
// Endpoints:
//   GET /api/products/featured?limit=8
//   GET /api/products/handle/:handle        -> { ok, product } (offline fallback in dev if enabled)
//   GET /api/products/id/:gid               -> { ok, product } (offline fallback in dev if enabled)
//
// NOTES:
// - No auth required to *view* products; keep wishlist endpoints behind requireAuth.
// - Uses SHOPIFY_STOREFRONT_TOKEN (+ domain/version picked up by utils/shopify.js).

import express from 'express';
import { storefrontFetch } from '../utils/shopify.js';

const router = express.Router();
router.use(express.json({ limit: '512kb' }));
router.use(express.urlencoded({ extended: false }));

// Optional: prefer a specific collection for "featured" if provided
const FEATURED_COLLECTION_HANDLE = process.env.FEATURED_COLLECTION_HANDLE || ''; // optional
const OFFLINE_OK = process.env.ALLOW_OFFLINE_PRODUCTS === '1' || (process.env.NODE_ENV !== 'production');

// -------- Helpers ----------
async function shopifyGQL(query, variables) {
  // Slightly longer timeout to reduce ETIMEDOUT during slow edges
  return await storefrontFetch(query, variables, { timeoutMs: 10000, retries: 2 });
}

function offlineItems(limit = 8) {
  const cats = ['Toys', 'Treats', 'Accessories'];
  return Array.from({ length: limit }).map((_, i) => {
    const idx = i + 1;
    const cat = cats[i % cats.length];
    return {
      id: `gid://shopify/Product/offline-${idx}`,
      title: `Demo Product ${idx}`,
      handle: `demo-product-${idx}`,
      availableForSale: true,
      featuredImage: { url: '/assets/images/placeholder.png', altText: `Demo ${idx}`, width: 800, height: 800 },
      priceRange: {
        minVariantPrice: { amount: (9.99 + i).toFixed(2), currencyCode: 'USD' },
        maxVariantPrice: { amount: (19.99 + i).toFixed(2), currencyCode: 'USD' }
      },
      productType: cat,
      tags: ['demo', cat.toLowerCase()]
    };
  });
}

function offlineProductByHandle(handle) {
  return {
    id: `gid://shopify/Product/offline-${handle}`,
    title: `Demo: ${handle}`,
    handle,
    descriptionHtml: `<p>This is a demo product shown because Shopify is offline.</p>`,
    vendor: 'Demo',
    productType: 'Demo',
    availableForSale: true,
    featuredImage: { url: '/assets/images/placeholder.png', altText: 'Demo Image', width: 800, height: 800 },
    images: { edges: [{ node: { id: 'img1', url: '/assets/images/placeholder.png', altText: 'Demo', width: 800, height: 800 } }] },
    variants: { edges: [{
      node: {
        id: `gid://shopify/ProductVariant/offline-${handle}`,
        title: 'Default',
        availableForSale: true,
        price: { amount: '14.99', currencyCode: 'USD' },
        compareAtPrice: null,
        selectedOptions: [{ name: 'Title', value: 'Default' }]
      }
    }]},
    priceRange: {
      minVariantPrice: { amount: '14.99', currencyCode: 'USD' },
      maxVariantPrice: { amount: '19.99', currencyCode: 'USD' }
    }
  };
}

// -------- Routes ----------

// GET /api/products/featured?limit=8
router.get('/featured', async (req, res) => {
  const limit = Math.min(Math.max(parseInt(req.query.limit || '8', 10), 1), 250);

  // Query productType & tags so filters work on the client
  const productFields = `
    id
    title
    handle
    availableForSale
    productType
    tags
    featuredImage { url altText width height }
    priceRange {
      minVariantPrice { amount currencyCode }
      maxVariantPrice { amount currencyCode }
    }
  `;

  try {
    if (FEATURED_COLLECTION_HANDLE) {
      const q = /* GraphQL */ `
        query Featured($handle:String!, $first:Int!) {
          collectionByHandle(handle:$handle) {
            id
            title
            handle
            products(first:$first, sortKey:BEST_SELLING) {
              edges { node { ${productFields} } }
            }
          }
        }
      `;
      const data = await shopifyGQL(q, { handle: FEATURED_COLLECTION_HANDLE, first: limit });
      const edges = data?.collectionByHandle?.products?.edges || [];
      const items = edges.map(e => e.node);
      return res.json({
        ok: true,
        source: 'collection',
        collection: data?.collectionByHandle?.handle || null,
        count: items.length,
        items,
        products: items
      });
    }

    // Fallback: site-wide best sellers
    const q = /* GraphQL */ `
      query Top($first:Int!) {
        products(first:$first, sortKey:BEST_SELLING) {
          edges { node { ${productFields} } }
        }
      }
    `;
    const data = await shopifyGQL(q, { first: limit });
    const edges = data?.products?.edges || [];
    const items = edges.map(e => e.node);
    return res.json({ ok: true, source: 'site', count: items.length, items, products: items });
  } catch (e) {
    console.error('GET /api/products/featured error:', e);
    if (OFFLINE_OK) {
      const items = offlineItems(limit);
      return res.status(200).json({ ok: true, source: 'offline', count: items.length, items, products: items });
    }
    const code = (e?.name === 'AbortError') ? 504 : 502;
    return res.status(code).json({ ok: false, error: 'SHOPIFY_FETCH_FAILED', message: 'Failed to load featured products' });
  }
});

// GET /api/products/handle/:handle
router.get('/handle/:handle', async (req, res) => {
  try {
    const handle = String(req.params.handle || '');
    if (!handle) return res.status(400).json({ ok: false, error: 'MISSING_HANDLE' });

    const q = /* GraphQL */ `
      query Product($handle:String!) {
        productByHandle(handle:$handle) {
          id
          title
          handle
          descriptionHtml
          vendor
          productType
          availableForSale
          featuredImage { url altText width height }
          images(first: 12) { edges { node { id url altText width height } } }
          variants(first: 30) {
            edges {
              node {
                id
                title
                availableForSale
                price { amount currencyCode }
                compareAtPrice { amount currencyCode }
                selectedOptions { name value }
              }
            }
          }
          priceRange {
            minVariantPrice { amount currencyCode }
            maxVariantPrice { amount currencyCode }
          }
        }
      }
    `;
    const data = await shopifyGQL(q, { handle });
    const p = data?.productByHandle || null;
    if (!p) {
      if (OFFLINE_OK) return res.json({ ok: true, product: offlineProductByHandle(handle) });
      return res.status(404).json({ ok: false, error: 'NOT_FOUND' });
    }
    return res.json({ ok: true, product: p });
  } catch (e) {
    console.error('GET /api/products/handle/:handle error:', e);
    if (OFFLINE_OK) return res.json({ ok: true, product: offlineProductByHandle(String(req.params.handle || 'demo')) });
    const code = (e?.name === 'AbortError') ? 504 : 502;
    return res.status(code).json({ ok: false, error: 'SHOPIFY_FETCH_FAILED', message: 'Failed to load product' });
  }
});

// GET /api/products/id/:gid (Shopify GID)
router.get('/id/:gid', async (req, res) => {
  try {
    const gid = String(req.params.gid || '');
    if (!gid) return res.status(400).json({ ok: false, error: 'MISSING_ID' });

    const q = /* GraphQL */ `
      query ProductNode($id:ID!) {
        node(id:$id) {
          ... on Product {
            id
            title
            handle
            descriptionHtml
            availableForSale
            featuredImage { url altText width height }
            images(first: 12) { edges { node { id url altText width height } } }
            variants(first: 30) {
              edges {
                node {
                  id
                  title
                  availableForSale
                  price { amount currencyCode }
                  compareAtPrice { amount currencyCode }
                  selectedOptions { name value }
                }
              }
            }
            priceRange {
              minVariantPrice { amount currencyCode }
              maxVariantPrice { amount currencyCode }
            }
          }
        }
      }
    `;
    const data = await shopifyGQL(q, { id: gid });
    const p = data?.node || null;
    if (!p) {
      if (OFFLINE_OK) return res.json({ ok: true, product: offlineProductByHandle('demo-product') });
      return res.status(404).json({ ok: false, error: 'NOT_FOUND' });
    }
    return res.json({ ok: true, product: p });
  } catch (e) {
    console.error('GET /api/products/id/:gid error:', e);
    if (OFFLINE_OK) return res.json({ ok: true, product: offlineProductByHandle('demo-product') });
    const code = (e?.name === 'AbortError') ? 504 : 502;
    return res.status(code).json({ ok: false, error: 'SHOPIFY_FETCH_FAILED', message: 'Failed to load product' });
  }
});

export default router;