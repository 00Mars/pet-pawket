// server.js
import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import session from 'express-session';
import fetch from 'node-fetch';
import wishlistRoutes from './routes/wishlistRoutes.js';
import userRoute from './routes/userRoute.js';
import { initDB } from './userDB.js';
await initDB(); // ⬅ necessary to initialize the database connection
import { getUserByEmail, updateUser } from './userDB.js';
import { createToken } from './utils/auth.js';

const app = express();
const PORT = process.env.PORT || 3001;
app.use('/api/user', userRoute);
// Session middleware
app.use(session({
  secret: process.env.SESSION_SECRET || 'changeme',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, httpOnly: true, maxAge: 86400000 }
}));

app.use(express.json());
app.use('/api/wishlist', wishlistRoutes);

import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
app.use(express.static(path.join(__dirname, 'public')));

// middleware/auth.js

import { requireAuth } from './middleware/requireAuth.js';


import signupRoute from './routes/signup-route.js';

app.use(signupRoute);


const SHOPIFY_API_ENDPOINT = `https://${process.env.SHOPIFY_DOMAIN}/api/2024-04/graphql.json`;

// Login route
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;

  const query = `
    mutation customerAccessTokenCreate($input: CustomerAccessTokenCreateInput!) {
      customerAccessTokenCreate(input: $input) {
        customerAccessToken {
          accessToken
          expiresAt
        }
        customerUserErrors {
          message
        }
      }
    }
  `;

  const variables = {
    input: { email, password }
  };

  try {
    const shopifyResponse = await fetch(SHOPIFY_API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Storefront-Access-Token': process.env.SHOPIFY_STOREFRONT_TOKEN
      },
      body: JSON.stringify({ query, variables })
    });

    const result = await fetch(SHOPIFY_API_ENDPOINT, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Shopify-Storefront-Access-Token': process.env.SHOPIFY_STOREFRONT_TOKEN
  },
  body: JSON.stringify({ query, variables })
}).then(res => res.json());

console.log("[Shopify login] Raw result:", result);

if (!result?.data?.customerAccessTokenCreate) {
  console.error("[login] Shopify response structure invalid:", result);
  return res.status(502).json({ error: 'Shopify login failed (invalid response structure)' });
}

const data = result.data.customerAccessTokenCreate;

if (data.customerUserErrors.length > 0 || !data.customerAccessToken) {
  return res.status(401).json({
    error: data.customerUserErrors?.[0]?.message || 'Invalid Shopify credentials'
  });
}


    const accessToken = data.customerAccessToken.accessToken;

    // 🔍 Local user fetch
    const localUser = await getUserByEmail(email);
    if (!localUser || !localUser.id) {
      console.error("[login] Local user not found or invalid:", localUser);
      return res.status(404).json({ error: 'Local user not found or missing ID' });
    }

    // 🛡️ JWT creation
    const token = createToken(localUser);
    console.log("[login] JWT generated:", token);

    return res.json({
      shopifyAccessToken: accessToken,
      token,
      user: {
        id: localUser.id,
        email: localUser.email,
        firstName: localUser.firstName,
        lastName: localUser.lastName
      }
    });
  } catch (err) {
    console.error("[login] Error during Shopify login:", err);
    return res.status(500).json({ error: 'Login failed' });
  }
});


app.get('/api/me', requireAuth, (req, res) => {
  res.json({
    id: req.user.id,
    email: req.user.email
  });
});


// Logout route
app.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('connect.sid');
    res.json({ success: true });
  });
});

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));


app.get('/api/orders', requireAuth, async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  const shopifyAccessToken = req.headers['x-shopify-access-token'];

  if (!token) return res.status(401).json({ error: 'Missing token' });
  if (!shopifyAccessToken) return res.status(401).json({ error: 'Missing Shopify token' });

  const query = `
    query {
      customer(customerAccessToken: "${shopifyAccessToken}") {
        orders(first: 5, sortKey: PROCESSED_AT, reverse: true) {
          edges {
            node {
              id
              orderNumber
              processedAt
              totalPriceV2 { amount, currencyCode }
              statusUrl
              lineItems(first: 5) {
                edges {
                  node {
                    title
                    quantity
                  }
                }
              }
            }
          }
        }
      }
    }
  `;

  try {
    const response = await fetch(`https://${process.env.SHOPIFY_DOMAIN}/api/2024-04/graphql.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Storefront-Access-Token': process.env.SHOPIFY_STOREFRONT_TOKEN
      },
      body: JSON.stringify({ query })
    });

    const result = await response.json();

    const orders = result?.data?.customer?.orders?.edges?.map(e => e.node) || [];
    res.json({ orders });
  } catch (err) {
    console.error('[orders] Error:', err);
    res.status(500).json({ error: 'Unable to fetch orders', message: err.message });
  }
});
 
import journalRoutes from './routes/journalRoutes.js';
app.use('/api/profile', journalRoutes);

import profileRoutes from './routes/profile.js';
app.use('/api/profile', profileRoutes);
