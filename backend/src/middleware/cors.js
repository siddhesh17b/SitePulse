const cors = require('cors');

// Allowed dashboard origins for Admin APIs
const defaultAllowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:5000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5000'
];

if (process.env.DASHBOARD_URL) {
  defaultAllowedOrigins.push(process.env.DASHBOARD_URL.trim());
}

if (process.env.RENDER_EXTERNAL_URL) {
  defaultAllowedOrigins.push(process.env.RENDER_EXTERNAL_URL.trim());
}

if (process.env.RENDER_EXTERNAL_HOSTNAME) {
  defaultAllowedOrigins.push(`https://${process.env.RENDER_EXTERNAL_HOSTNAME.trim()}`);
  defaultAllowedOrigins.push(`http://${process.env.RENDER_EXTERNAL_HOSTNAME.trim()}`);
}

if (process.env.ALLOWED_ORIGINS) {
  process.env.ALLOWED_ORIGINS.split(',').forEach((orig) => {
    if (orig.trim()) defaultAllowedOrigins.push(orig.trim());
  });
}

// Public CORS: Unrestricted for client-side embed scripts and visitor interactions
const publicCors = cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
  exposedHeaders: ['X-Request-ID']
});

// Admin CORS: Dynamic detection of same-origin (custom domains/VPS), authorized hosts & Render
const adminCors = cors((req, callback) => {
  const origin = req.headers.origin;

  // Requests without origin (e.g. mobile apps, curl, server-to-server)
  if (!origin) {
    return callback(null, { origin: true });
  }

  // Same-Origin auto-allowance for self-hosters / custom domains:
  // If the origin matches the host header (e.g., https://support.mycompany.com)
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const isSameOrigin = Boolean(
    host && (
      origin === `http://${host}` ||
      origin === `https://${host}` ||
      origin.endsWith(`://${host}`)
    )
  );

  const isAllowed = defaultAllowedOrigins.some((allowed) => {
    return origin === allowed || origin.endsWith(allowed.replace(/^https?:\/\//, ''));
  });

  const isRender = origin.endsWith('.onrender.com');

  if (isSameOrigin || isAllowed || isRender || process.env.NODE_ENV === 'test') {
    return callback(null, {
      origin: true,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
      exposedHeaders: ['X-Request-ID']
    });
  }

  return callback(new Error(`CORS blocked: Origin ${origin} not authorized for Admin API`));
});

module.exports = {
  publicCors,
  adminCors,
  allowedOrigins: defaultAllowedOrigins
};
