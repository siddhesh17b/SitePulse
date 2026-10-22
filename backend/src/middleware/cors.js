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

// Admin CORS: Restricted to authorized dashboard hosts and same-origin requests
const adminCors = cors({
  origin: (origin, callback) => {
    // Requests without origin (e.g. mobile apps, curl, server-to-server, same-origin)
    if (!origin) return callback(null, true);

    const isAllowed = defaultAllowedOrigins.some((allowed) => {
      return origin === allowed || origin.endsWith(allowed.replace(/^https?:\/\//, ''));
    });

    if (isAllowed || process.env.NODE_ENV === 'test') {
      return callback(null, true);
    }

    return callback(new Error(`CORS blocked: Origin ${origin} not authorized for Admin API`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
  exposedHeaders: ['X-Request-ID']
});

module.exports = {
  publicCors,
  adminCors,
  allowedOrigins: defaultAllowedOrigins
};
