import { verifyToken } from '../utils/auth.js';

export function requireAuth(req, res, next) {
  const bearerHeader = req.headers['authorization'];
  const cookieToken = req.cookies?.authToken;
  const token = cookieToken || (bearerHeader?.startsWith('Bearer ') ? bearerHeader.split(' ')[1] : null);

  console.log('[AUTH] Headers:', req.headers);
  console.log('[AUTH] Cookie token:', cookieToken);
  console.log('[AUTH] Authorization header:', bearerHeader);
  console.log('[AUTH] Selected token:', token);

  if (!token) {
    console.warn('[AUTH] Missing token');
    return res.status(401).json({ message: 'Missing token' });
  }

  try {
    const payload = verifyToken(token);
    console.log('[AUTH] Token verified. Payload:', payload);
    req.user = payload;
    next();
  } catch (err) {
    console.error('[AUTH] JWT verification failed:', err.message);
    return res.status(403).json({ message: 'Invalid token' });
  }
}
