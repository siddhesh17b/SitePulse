const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

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

// Enable CORS for all origins (Embed script on client websites & Dashboard)
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Serve static widget file if accessed via http://localhost:PORT/sitepulse.js
app.use('/widget', express.static(path.join(__dirname, '../../widget')));
app.get('/sitepulse.js', (req, res) => {
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
// REST API ROUTE MOUNTING
// -------------------------------------------------------------

// System Health Check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date() });
});

// Domain Routers
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/sites', sitesRoutes);
app.use('/api/v1/widget', widgetRoutes);
app.use('/api/v1/conversations', conversationsRoutes);
app.use('/api/v1/feedback', feedbackRoutes);
app.use('/api/v1/bugs', bugsRoutes);
app.use('/api/v1/events', eventsRoutes);

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

// Centralized Global Error Handler
app.use((err, req, res, next) => {
  console.error('[Server Error]', err);
  if (res.headersSent) return next(err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error'
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`===============================================`);
  console.log(`🚀 SitePulse Production Server running on port ${PORT}`);
  console.log(`📊 Unified Dashboard at: http://localhost:${PORT}/`);
  console.log(`📡 Socket.IO gateway ready on port ${PORT}`);
  console.log(`📦 Widget served at: http://localhost:${PORT}/sitepulse.js`);
  console.log(`===============================================`);
});
