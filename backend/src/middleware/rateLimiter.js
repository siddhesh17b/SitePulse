const rateLimit = require('express-rate-limit');

// Rate Limiter: Max 120 new conversations per minute per IP
const conversationInitLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 120, // Limit each IP to 120 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many conversations started from this IP. Please wait a minute before starting another.'
  }
});

module.exports = {
  conversationInitLimiter
};
