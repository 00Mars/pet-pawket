import dotenv from 'dotenv';
dotenv.config(); // ← load .env into this file's scope
import express from 'express';
import fetch from 'node-fetch';
const router = express.Router();

const SHOPIFY_API_ENDPOINT = `https://${process.env.SHOPIFY_DOMAIN}/api/2024-04/graphql.json`;

router.post('/signup', async (req, res) => {
  const { email, password, firstName, lastName } = req.body;

  const query = `
    mutation customerCreate($input: CustomerCreateInput!) {
      customerCreate(input: $input) {
        customer {
          id
          email
        }
        customerUserErrors {
          field
          message
        }
      }
    }
  `;

  const variables = {
    input: { email, password, firstName, lastName }
  };

  try {
    const response = await fetch(SHOPIFY_API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Storefront-Access-Token': process.env.SHOPIFY_STOREFRONT_TOKEN
      },
      body: JSON.stringify({ query, variables })
    });

    const result = await response.json();

    console.log('[Shopify Response]', JSON.stringify(result, null, 2));

    const data = result.data.customerCreate;

    if (data.customer && result.data.customerCreate.customer.id) {
  // Auto-login after signup by generating a token
  const loginMutation = `
    mutation {
      customerAccessTokenCreate(input: {
        email: "${email}",
        password: "${password}"
      }) {
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

  const loginRes = await fetch(SHOPIFY_API_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Storefront-Access-Token': process.env.SHOPIFY_STOREFRONT_TOKEN
    },
    body: JSON.stringify({ query: loginMutation })
  });

  const loginData = await loginRes.json();
  const tokenData = loginData.data.customerAccessTokenCreate;

  if (tokenData.customerAccessToken) {
    req.session.shopify = {
      email,
      accessToken: tokenData.customerAccessToken.accessToken
    };
    res.json({ success: true, email });
  } else {
    console.error('[signup] Failed auto-login:', tokenData.customerUserErrors);
    res.status(200).json({ success: true, email }); // still signed up, just not auto-logged in
  }
}
 else {
      res.status(400).json({ error: data.customerUserErrors[0]?.message || 'Signup failed' });
    }
  } catch (err) {
  console.error('[signup] Error:', err);
  if (err.response) {
    err.response.text().then(text => console.error('[signup] Shopify response:', text));
  }
  res.status(500).json({ error: 'Internal server error' });
}

});

export default router;
