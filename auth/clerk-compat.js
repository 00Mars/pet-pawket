// auth/clerk-compat.js
// Minimal Clerk compatibility shim powered by Shopify customerAccessToken.
// Lets existing routes keep using `getAuth` / `requireAuth` without Clerk.

function parseCookies(req) {
  const h = req.headers?.cookie || '';
  return Object.fromEntries(
    h.split(';')
      .map(v => v.trim())
      .filter(Boolean)
      .map(kv => {
        const i = kv.indexOf('=');
        return i === -1
          ? [kv, '']
          : [decodeURIComponent(kv.slice(0, i)), decodeURIComponent(kv.slice(i + 1))];
      })
  );
}

function getShopifyTokenFromReq(req) {
  // Prefer header for backward compat; otherwise use the login cookie
  return req.headers['x-shopify-access-token'] || parseCookies(req).shopify_token || null;
}

// No-op middleware so you don't have to remove it everywhere
export function clerkMiddleware() {
  return (_req, _res, next) => next();
}

// Match Clerk's getAuth shape, but base it on Shopify token presence
export function getAuth(req) {
  const token = getShopifyTokenFromReq(req);
  // userId is truthy if signed in; we set it to the token for compatibility.
  return token ? { userId: token, user: null } : { userId: null, user: null };
}

// Replacement for Clerk's requireAuth()
export function requireAuth() {
  return (req, res, next) => {
    const token = getShopifyTokenFromReq(req);
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    // Attach for downstream use if needed
    req.shopifyToken = token;
    next();
  };
}