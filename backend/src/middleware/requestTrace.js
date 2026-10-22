const crypto = require('crypto');
const pinoHttp = require('pino-http');
const logger = require('../utils/logger');

const httpLogger = pinoHttp({
  logger,
  genReqId: (req) => {
    return req.headers['x-request-id'] || crypto.randomUUID();
  },
  // Suppress static assets and font loading spam from terminal
  autoLogging: {
    ignore: (req) => {
      const url = (req.url || '').split('?')[0];
      return (
        url.startsWith('/assets/') ||
        url.startsWith('/widget/fonts/') ||
        /\.(woff2?|ttf|eot|css|js|ico|png|jpg|jpeg|svg|webp|map)$/i.test(url)
      );
    }
  },
  // Keep logs compact and strip huge header dumps
  serializers: {
    req: (req) => ({
      id: req.id,
      method: req.method,
      url: req.url
    }),
    res: (res) => ({
      statusCode: res.statusCode
    })
  },
  customLogLevel: (req, res, err) => {
    if (res.statusCode >= 500 || err) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
  customSuccessMessage: (req, res, responseTime) => {
    return `${req.method} ${req.url} ${res.statusCode} (${Math.round(responseTime)}ms)`;
  },
  customErrorMessage: (req, res, err) => {
    return `${req.method} ${req.url} failed with ${res.statusCode}: ${err.message}`;
  }
});

function requestTrace(req, res, next) {
  const reqId = req.headers['x-request-id'] || crypto.randomUUID();
  req.id = reqId;
  res.setHeader('X-Request-ID', reqId);
  httpLogger(req, res, next);
}

module.exports = requestTrace;
