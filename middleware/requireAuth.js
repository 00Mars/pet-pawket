import { verifyToken } from '../utils/auth.js';

export function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ error: 'Missing token' });

  try {
    const decoded = verifyToken(token); // <== must succeed
    req.user = decoded;
    next();
  } catch (err) {
    console.error("[auth] Invalid token:", err.message);
    return res.status(401).json({ error: 'Invalid token' });
  }
}
