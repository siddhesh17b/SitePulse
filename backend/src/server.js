const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const helmet = require('helmet');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

// Load environment variables flexibly (supports running from root or backend/)
const backendEnv = path.join(__dirname, '../.env');
const rootEnv = path.join(__dirname, '../../.env');
if (fs.existsSync(backendEnv)) dotenv.config({ path: backendEnv });
if (fs.existsSync(rootEnv)) dotenv.config({ path: rootEnv, override: false });
dotenv.config();

// Database & Logging
const prisma = require('./db');
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
const indexPath = path.join(dashboardDist, 'index.html');

// Auto-build dashboard with Vite if missing so npm start works out-of-the-box
if (!fs.existsSync(indexPath)) {
  const dashboardDir = path.join(__dirname, '../../dashboard');
  if (fs.existsSync(path.join(dashboardDir, 'package.json'))) {
    try {
      console.log('Building dashboard with Vite (initial setup)...');
      const { execSync } = require('child_process');
      execSync('npm run build', {
        cwd: dashboardDir,
        stdio: 'inherit'
      });
    } catch (e) {
      console.warn('Dashboard auto-build warning:', e.message);
    }
  }
}

app.use(express.static(dashboardDist));

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/widget') || req.path.startsWith('/demo') || req.path === '/sitepulse.js') {
    return next();
  }
  if (fs.existsSync(indexPath)) {
    return res.sendFile(indexPath);
  }
  res.status(200).send(`
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>SitePulse - Ready</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f8fafc; color: #0f172a; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
          .card { background: white; padding: 2.5rem; border-radius: 1rem; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); max-width: 480px; text-align: center; border: 1px solid #e2e8f0; }
          h2 { margin: 0 0 0.5rem; color: #0f172a; }
          p { color: #64748b; font-size: 0.95rem; line-height: 1.5; }
          code { background: #f1f5f9; padding: 0.2rem 0.5rem; border-radius: 0.25rem; font-family: monospace; color: #287170; font-weight: 600; }
        </style>
      </head>
      <body>
        <div class="card">
          <h2>SitePulse Gateway Running</h2>
          <p>The backend API and Socket.IO server are online.</p>
          <p>The dashboard SPA is compiling. Run <code>npm run build:dashboard</code> or restart to finish setup.</p>
        </div>
      </body>
    </html>
  `);
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

// Graceful Port Conflict Handling
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n❌ Port ${PORT} is already in use by another process.`);
    console.error(`To fix this:`);
    console.error(`1. Stop the existing process running on port ${PORT}, OR`);
    console.error(`2. Set a different port in your environment: e.g. PORT=5001 npm start\n`);
    process.exit(1);
  } else {
    console.error('Server startup error:', err);
    process.exit(1);
  }
});

server.listen(PORT, () => {
  logger.info({ port: PORT }, 'SitePulse server listening');
  console.log(`===============================================`);
  console.log(`SitePulse Production Server running on port ${PORT}`);
  console.log(`Unified Dashboard at: \x1b[32mhttp://localhost:${PORT}/\x1b[0m`);
  console.log(`Socket.IO gateway ready on port ${PORT}`);
  console.log(`Widget served at: http://localhost:${PORT}/sitepulse.js`);
  console.log(`===============================================`);

  // Non-blocking database connectivity check
  if (prisma && prisma.$connect) {
    prisma.$connect().catch((err) => {
      console.warn(`\n⚠️  Database notice: Could not connect to PostgreSQL.`);
      console.warn(`Details: ${err.message}`);
      console.warn(`Ensure DATABASE_URL is configured and PostgreSQL is running.\n`);
    });
  }
});
