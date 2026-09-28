const jwt = require('jsonwebtoken');

const prisma = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'sitepulse-super-secret-jwt-key-2026';

// Unique instance ID generated per server boot.
// When the backend server is stopped (Ctrl+C) and restarted, a new ID is generated,
// instantly invalidating previous sessions so the admin must log in again.
const SERVER_INSTANCE_ID = Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 9);

async function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    return res.status(401).json({ error: 'Access denied. No authorization header provided.' });
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return res.status(401).json({ error: 'Invalid authorization format. Format should be: Bearer <token>' });
  }

  const token = parts[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    // If server restarted since token was issued, invalidate session
    if (!decoded.instanceId || decoded.instanceId !== SERVER_INSTANCE_ID) {
      return res.status(401).json({ error: 'Server was restarted. Please log in again.' });
    }

    // Verify user exists and is still valid in database
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, email: true, name: true, role: true }
    });

    if (!user) {
      return res.status(401).json({ error: 'User session expired or account no longer exists.' });
    }

    req.user = {
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role
    };

    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token. Please log in again.' });
  }
}

module.exports = {
  authMiddleware,
  JWT_SECRET,
  SERVER_INSTANCE_ID
};
