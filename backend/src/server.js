const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const helmet = require('helmet');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

// Logging & Tracing
const logger = require('./utils/logger');
const requestTrace = require('./middleware/requestTrace');
const { publicCors, adminCors } = require('./middleware/cors');

// Route Modules
const authRoutes = require('./routes/auth');
const sitesRoutes = require('./routes/sites');
const widgetRoutes = require('./routes/widget');
const conversationsRoutes = require('./routes/conversations');
const feedbackRoutes = require('./routes/feedback');
const bugsRoutes = require('./routes/bugs');
const eventsRoutes = require('./routes/events');

// Socket Gateway
const registerChatSocket = require('./sockets/chatSocket');

const app = express();
const server = http.createServer(app);

// HTTP Security Headers (Safe for third-party embeds & self-hosted fonts)
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: false
}));

// Request Tracing (Assigns X-Request-ID and structured HTTP logging)
app.use(requestTrace);

app.use(express.json());

// Public CORS for Widget Embed Script & Assets
app.use('/widget', publicCors, express.static(path.join(__dirname, '../../widget')));
app.get('/sitepulse.js', publicCors, (req, res) => {
  res.sendFile(path.join(__dirname, '../../widget/sitepulse.js'));
});

// Optional Demo Site static routes (for local developer testing)
const demoSitePath = path.join(__dirname, '../../demo-site');
if (fs.existsSync(demoSitePath)) {
  app.use('/demo-site', express.static(demoSitePath));
  app.use('/demo', express.static(path.join(demoSitePath, 'demo1')));
  app.use('/demo1', express.static(path.join(demoSitePath, 'demo1')));
  app.use('/demo2', express.static(path.join(demoSitePath, 'demo2/src')));
}

// Socket.IO Setup & Event Gateway
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});
registerChatSocket(io);

// Expose io instance to route handlers via req.io
app.use((req, res, next) => {
  req.io = io;
  next();
});

// -------------------------------------------------------------
// REST API ROUTE MOUNTING & ROUTE-SPECIFIC CORS
// -------------------------------------------------------------

// System Health Check (Public)
app.get('/api/health', publicCors, (req, res) => {
  res.json({ status: 'ok', time: new Date() });
});

// Admin API Routes (Restricted CORS to Dashboard origins)
app.use('/api/v1/auth', adminCors, authRoutes);
app.use('/api/v1/sites', adminCors, sitesRoutes);

// Public Widget Interaction Endpoints (Open CORS for visitor embeds)
app.use('/api/v1/widget', publicCors, widgetRoutes);
app.use('/api/v1/feedback', publicCors, feedbackRoutes);
app.use('/api/v1/bugs', publicCors, bugsRoutes);
app.use('/api/v1/events', publicCors, eventsRoutes);

// Conversations API (Hybrid: Public /init for visitors, Admin CORS for operators)
app.use('/api/v1/conversations', conversationsRoutes);

// -------------------------------------------------------------
// UNIFIED PRODUCTION DASHBOARD SERVING (Single-Port Setup)
// -------------------------------------------------------------
const dashboardDist = path.join(__dirname, '../../dashboard/dist');
app.use(express.static(dashboardDist));

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/widget') || req.path.startsWith('/demo') || req.path === '/sitepulse.js') {
    return next();
  }
  const indexPath = path.join(dashboardDist, 'index.html');
  if (fs.existsSync(indexPath)) {
    return res.sendFile(indexPath);
  }
  res.status(200).send('SitePulse API and Gateway running. Dashboard build not found.');
});

// Unhandled API Route 404
app.all('/api/*', (req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Centralized Global Error Handler (Structured JSON Logger)
app.use((err, req, res, next) => {
  logger.error({
    err: {
      message: err.message,
      stack: err.stack,
      status: err.status || 500
    },
    reqId: req.id,
    url: req.originalUrl,
    method: req.method
  }, 'Unhandled Server Error');

  if (res.headersSent) return next(err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    requestId: req.id
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  logger.info({ port: PORT }, 'SitePulse server listening');
  console.log(`===============================================`);
  console.log(`🚀 SitePulse Production Server running on port ${PORT}`);
  console.log(`📊 Unified Dashboard at: http://localhost:${PORT}/`);
  console.log(`📡 Socket.IO gateway ready on port ${PORT}`);
  console.log(`📦 Widget served at: http://localhost:${PORT}/sitepulse.js`);
  console.log(`===============================================`);
});
