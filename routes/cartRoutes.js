import express from 'express';
import { storefrontFetch } from '../utils/shopify.js';

const router = express.Router();
router.use(express.json({ limit: '256kb' }));

router.post('/create', async (req, res) => {
  try {
    const lines = Array.isArray(req.body?.lines) ? req.body.lines : [];
    const data = await storefrontFetch(/* GraphQL */`
      mutation CartCreate($input: CartInput) {
        cartCreate(input: $input) {
          cart { id checkoutUrl }
          userErrors { field message code }
        }
      }
    `, { input: { lines } }, { timeoutMs: 7000, retries: 1 });

    const payload = data?.cartCreate;
    const url = payload?.cart?.checkoutUrl;
    if (!url) {
      return res.status(502).json({ ok:false, error:'CART_CREATE_FAILED', details: payload?.userErrors || [] });
    }
    res.json({ ok:true, checkoutUrl: url });
  } catch (e) {
    console.error('[cart/create] error:', e);
    res.status(502).json({ ok:false, error:'STORE_FRONT_ERROR' });
  }
});

export default router;