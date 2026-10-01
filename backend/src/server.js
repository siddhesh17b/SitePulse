const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const prisma = require('./db');
const bcrypt = require('bcryptjs');
const { authMiddleware } = require('./middleware/auth');
const authRoutes = require('./routes/auth');

const app = express();
const server = http.createServer(app);

// Rate Limiter: Max 60 new conversations per minute per IP
const conversationInitLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // Limit each IP to 60 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many conversations started from this IP. Please wait a minute before starting another.'
  }
});

// Enable CORS for all origins (Embed script on client websites & Dashboard)
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Serve static widget file if accessed via http://localhost:PORT/sitepulse.js
app.use('/widget', express.static(path.join(__dirname, '../../widget')));
app.get('/sitepulse.js', (req, res) => {
  res.sendFile(path.join(__dirname, '../../widget/sitepulse.js'));
});
app.use('/demo-site', express.static(path.join(__dirname, '../../demo-site')));
app.use('/demo', express.static(path.join(__dirname, '../../demo-site/demo1')));
app.use('/demo1', express.static(path.join(__dirname, '../../demo-site/demo1')));
app.use('/demo2', express.static(path.join(__dirname, '../../demo-site/demo2/src')));

// Mount Authentication Routes
app.use('/api/v1/auth', authRoutes);

// Socket.IO Setup
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Real-time Chat Gateway
io.on('connection', (socket) => {
  // Admin joins site-wide monitoring room
  socket.on('join_site_admin', ({ siteKey }) => {
    if (siteKey) {
      socket.join(`site_${siteKey}`);
    }
  });

  // Visitor or Agent joins specific conversation room
  socket.on('join_conversation', ({ conversationId }) => {
    if (conversationId) {
      socket.join(`conv_${conversationId}`);
    }
  });

  // Typing indicator
  socket.on('typing', ({ conversationId, senderType, isTyping }) => {
    socket.to(`conv_${conversationId}`).emit('typing', { senderType, isTyping });
  });

  // Sending message
  socket.on('send_message', async (data) => {
    try {
      const { conversationId, siteKey, senderType, content, senderName } = data;
      if (!conversationId || !content) return;

      // Ensure socket is joined to the conversation room
      socket.join(`conv_${conversationId}`);

      let savedMessage = null;
      if (prisma) {
        savedMessage = await prisma.message.create({
          data: {
            conversationId,
            senderType: senderType || 'visitor',
            senderName: senderName || (senderType === 'agent' ? 'Support Agent' : 'Visitor'),
            content: content.trim()
          }
        });

        // Update conversation lastMessageAt
        await prisma.conversation.update({
          where: { id: conversationId },
          data: { lastMessageAt: new Date() }
        });
      } else {
        savedMessage = {
          id: 'temp_' + Date.now(),
          conversationId,
          senderType,
          senderName,
          content,
          createdAt: new Date().toISOString()
        };
      }

      // Broadcast to both visitor and agent in conversation
      io.to(`conv_${conversationId}`).emit('message_received', savedMessage);

      // Notify admin inbox in site room
      if (siteKey) {
        io.to(`site_${siteKey}`).emit('new_message_notification', {
          conversationId,
          message: savedMessage
        });
      }
    } catch (err) {
      console.error('[Socket] Error handling send_message:', err);
      socket.emit('error', { message: 'Failed to send message' });
    }
  });
});

// -------------------------------------------------------------
// REST API ROUTES
// -------------------------------------------------------------

// 1. Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date() });
});

// 2. Sites Management (Protected for Logged-in Admins)
app.get('/api/v1/sites', authMiddleware, async (req, res) => {
  try {
    const sites = await prisma.site.findMany({
      where: {
        OR: [
          { userId: req.user.userId },
          { userId: null } // allow accessing unassigned demo site
        ]
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(sites);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/v1/sites', authMiddleware, async (req, res) => {
  try {
    const { name, domain } = req.body;
    if (!name || !domain) {
      return res.status(400).json({ error: 'Name and domain are required' });
    }
    const defaultSettings = {
      primaryColor: '#000000',
      title: 'SitePulse Support',
      subtitle: 'Ask us anything or leave feedback',
      greeting: 'Hi there! How can we help you today?',
      position: 'right',
      enableChat: true,
      enableFeedback: true,
      enableBugReport: true,
      requireEmail: false
    };

    const site = await prisma.site.create({
      data: {
        name,
        domain,
        userId: req.user.userId,
        widgetSettings: defaultSettings
      }
    });
    res.status(201).json(site);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Protected: Delete a Site and all its associated data (Requires Admin Password)
app.delete('/api/v1/sites/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ error: 'Your admin account password is required to delete this website property.' });
    }

    // Verify user password
    const adminUser = await prisma.user.findUnique({
      where: { id: req.user.userId }
    });

    if (!adminUser) {
      return res.status(404).json({ error: 'Admin account not found.' });
    }

    const isMatch = await bcrypt.compare(password, adminUser.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Incorrect password. Website deletion cancelled.' });
    }

    const site = await prisma.site.findUnique({ where: { id } });
    if (!site) {
      return res.status(404).json({ error: 'Site not found.' });
    }
    // Allow deleting if user owns it or if it is demo site
    if (site.userId && site.userId !== req.user.userId) {
      return res.status(403).json({ error: 'Unauthorized to delete this site.' });
    }

    await prisma.site.delete({ where: { id } });
    res.json({ success: true, message: 'Website property deleted successfully.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Protected: Delete all conversations for a site (Requires Admin Password)
app.delete('/api/v1/sites/:id/conversations', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ error: 'Your admin account password is required to delete all chats.' });
    }

    // Verify user password
    const adminUser = await prisma.user.findUnique({
      where: { id: req.user.userId }
    });

    if (!adminUser) {
      return res.status(404).json({ error: 'Admin account not found.' });
    }

    const isMatch = await bcrypt.compare(password, adminUser.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Incorrect password. Chat deletion cancelled.' });
    }

    const site = await prisma.site.findUnique({ where: { id } });
    if (!site) {
      return res.status(404).json({ error: 'Site not found.' });
    }
    if (site.userId && site.userId !== req.user.userId) {
      return res.status(403).json({ error: 'Unauthorized to delete conversations for this site.' });
    }

    // Delete messages first, then conversations
    await prisma.message.deleteMany({
      where: {
        conversation: {
          siteId: id
        }
      }
    });

    const deletedConvs = await prisma.conversation.deleteMany({
      where: { siteId: id }
    });

    // Notify any active clients connected to this site
    io.to(`site_${site.apiKey}`).emit('all_conversations_deleted', { siteId: id });

    res.json({
      success: true,
      message: `Successfully deleted ${deletedConvs.count} conversation(s).`,
      count: deletedConvs.count
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Widget Customization / Configuration API
// Public: Fetched by the embed script to customize itself dynamically on client website
app.get('/api/v1/widget/config', async (req, res) => {
  try {
    const { key } = req.query;
    if (!key) {
      return res.status(400).json({ error: 'Missing site key' });
    }

    const site = await prisma.site.findUnique({
      where: { apiKey: key },
      select: {
        id: true,
        name: true,
        domain: true,
        apiKey: true,
        widgetSettings: true
      }
    });

    if (!site) {
      return res.status(404).json({ error: 'Site not found for given key' });
    }

    res.json({
      siteId: site.id,
      siteName: site.name,
      settings: site.widgetSettings
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Protected: Update Widget Customization Settings (called from Admin Dashboard)
app.put('/api/v1/widget/config', authMiddleware, async (req, res) => {
  try {
    const { siteKey, settings } = req.body;
    if (!siteKey || !settings) {
      return res.status(400).json({ error: 'Missing siteKey or settings' });
    }

    const updatedSite = await prisma.site.update({
      where: { apiKey: siteKey },
      data: { widgetSettings: settings }
    });

    // Notify any active clients or dashboard of settings update
    io.to(`site_${siteKey}`).emit('widget_settings_updated', settings);

    res.json({ success: true, settings: updatedSite.widgetSettings });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Protected: Update Widget Customization Settings by Site ID
app.put('/api/v1/sites/:id/settings', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { settings } = req.body;
    if (!settings) {
      return res.status(400).json({ error: 'Settings object is required' });
    }

    const site = await prisma.site.findUnique({ where: { id } });
    if (!site) {
      return res.status(404).json({ error: 'Site not found' });
    }
    if (site.userId && site.userId !== req.user.userId) {
      return res.status(403).json({ error: 'Unauthorized to update settings for this site' });
    }

    const updatedSite = await prisma.site.update({
      where: { id },
      data: { widgetSettings: settings }
    });

    // Notify any active clients or dashboard of settings update
    io.to(`site_${site.apiKey}`).emit('widget_settings_updated', settings);

    res.json({ success: true, settings: updatedSite.widgetSettings });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Conversations API (Protected for Admin Dashboard)
app.get('/api/v1/conversations', authMiddleware, async (req, res) => {
  try {
    const { siteKey } = req.query;
    if (!siteKey) return res.status(400).json({ error: 'Missing siteKey' });

    const site = await prisma.site.findUnique({ where: { apiKey: siteKey } });
    if (!site) return res.status(404).json({ error: 'Site not found' });

    const conversations = await prisma.conversation.findMany({
      where: { siteId: site.id },
      include: {
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      },
      orderBy: { lastMessageAt: 'desc' }
    });

    res.json(conversations);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Public: Find or Create Conversation for a website visitor (Rate Limited: 5/min)
app.post('/api/v1/conversations/init', conversationInitLimiter, async (req, res) => {
  try {
    const { siteKey, visitorId, visitorName, visitorEmail, externalId } = req.body;
    if (!siteKey || !visitorId) {
      return res.status(400).json({ error: 'siteKey and visitorId are required' });
    }

    const site = await prisma.site.findUnique({ where: { apiKey: siteKey } });
    if (!site) return res.status(404).json({ error: 'Site not found' });

    // Look for existing conversation:
    // 1. If externalId is provided (authenticated user via SitePulse.identify), match siteId + externalId
    // 2. Otherwise match siteId + visitorId (device session)
    // NOTE: We deliberately do NOT match purely by visitorEmail alone for unverified guests.
    // This prevents malicious visitors from viewing another person's chats simply by typing their email.
    let conv = null;
    if (externalId) {
      conv = await prisma.conversation.findFirst({
        where: {
          siteId: site.id,
          externalId: String(externalId)
        },
        include: {
          messages: {
            orderBy: { createdAt: 'asc' }
          }
        }
      });
    }

    if (!conv) {
      conv = await prisma.conversation.findFirst({
        where: {
          siteId: site.id,
          visitorId: visitorId
        },
        include: {
          messages: {
            orderBy: { createdAt: 'asc' }
          }
        }
      });
    }

    if (conv) {
      const updateData = {};
      if (visitorEmail && visitorEmail !== conv.visitorEmail) updateData.visitorEmail = visitorEmail;
      if (visitorName && visitorName !== conv.visitorName) updateData.visitorName = visitorName;
      if (externalId && externalId !== conv.externalId) updateData.externalId = String(externalId);
      if (visitorId && visitorId !== conv.visitorId) updateData.visitorId = visitorId;

      if (Object.keys(updateData).length > 0) {
        conv = await prisma.conversation.update({
          where: { id: conv.id },
          data: updateData,
          include: {
            messages: {
              orderBy: { createdAt: 'asc' }
            }
          }
        });
      }
    } else {
      conv = await prisma.conversation.create({
        data: {
          siteId: site.id,
          visitorId,
          externalId: externalId ? String(externalId) : null,
          visitorName: visitorName || (visitorEmail ? visitorEmail.split('@')[0] : 'Visitor'),
          visitorEmail: visitorEmail || null
        },
        include: {
          messages: true
        }
      });
    }

    res.json(conv);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Protected: Get Messages for a specific conversation
app.get('/api/v1/conversations/:id/messages', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const messages = await prisma.message.findMany({
      where: { conversationId: id },
      orderBy: { createdAt: 'asc' }
    });
    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Protected: Update Conversation Status (e.g. "open" or "resolved")
app.patch('/api/v1/conversations/:id/status', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const conv = await prisma.conversation.update({
      where: { id },
      data: { status: status || 'open' }
    });
    res.json(conv);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Feedback API
// Public: Visitor submits feedback
app.post('/api/v1/feedback', async (req, res) => {
  try {
    const { siteKey, rating, comment, userEmail } = req.body;
    if (!siteKey || !rating || !comment) {
      return res.status(400).json({ error: 'siteKey, rating, and comment are required' });
    }

    const site = await prisma.site.findUnique({ where: { apiKey: siteKey } });
    if (!site) return res.status(404).json({ error: 'Site not found' });

    const feedback = await prisma.feedback.create({
      data: {
        siteId: site.id,
        rating: parseInt(rating, 10),
        comment,
        userEmail: userEmail || null
      }
    });

    // Notify admin
    io.to(`site_${siteKey}`).emit('new_feedback_received', feedback);

    res.status(201).json({ success: true, feedback });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Protected: Admin reads feedbacks
app.get('/api/v1/feedback', authMiddleware, async (req, res) => {
  try {
    const { siteKey } = req.query;
    if (!siteKey) return res.status(400).json({ error: 'Missing siteKey' });

    const site = await prisma.site.findUnique({ where: { apiKey: siteKey } });
    if (!site) return res.status(404).json({ error: 'Site not found' });

    const feedbacks = await prisma.feedback.findMany({
      where: { siteId: site.id },
      orderBy: { createdAt: 'desc' }
    });

    res.json(feedbacks);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 6. Bug Reports API
// Public: Visitor submits bug report
app.post('/api/v1/bugs', async (req, res) => {
  try {
    const { siteKey, title, description, userEmail, url, browser, device } = req.body;
    if (!siteKey || !title || !description) {
      return res.status(400).json({ error: 'siteKey, title, and description are required' });
    }

    const site = await prisma.site.findUnique({ where: { apiKey: siteKey } });
    if (!site) return res.status(404).json({ error: 'Site not found' });

    const bug = await prisma.bugReport.create({
      data: {
        siteId: site.id,
        title,
        description,
        userEmail: userEmail || null,
        url: url || null,
        browser: browser || null,
        device: device || null
      }
    });

    // Notify admin
    io.to(`site_${siteKey}`).emit('new_bug_received', bug);

    res.status(201).json({ success: true, bug });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Protected: Admin reads bug reports
app.get('/api/v1/bugs', authMiddleware, async (req, res) => {
  try {
    const { siteKey } = req.query;
    if (!siteKey) return res.status(400).json({ error: 'Missing siteKey' });

    const site = await prisma.site.findUnique({ where: { apiKey: siteKey } });
    if (!site) return res.status(404).json({ error: 'Site not found' });

    const bugs = await prisma.bugReport.findMany({
      where: { siteId: site.id },
      orderBy: { createdAt: 'desc' }
    });

    res.json(bugs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 7. Privacy-Preserving Analytics Ingestion API (Public)
app.post('/api/v1/events', async (req, res) => {
  try {
    const { siteKey, pathname, referrer, browser, os, deviceType } = req.body;
    if (!siteKey || !pathname) {
      return res.status(400).json({ error: 'siteKey and pathname are required' });
    }

    const site = await prisma.site.findUnique({ where: { apiKey: siteKey } });
    if (!site) return res.status(404).json({ error: 'Site not found' });

    // Generate daily privacy hash (no cookies, no storing raw IP)
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
    const userAgent = req.headers['user-agent'] || '';
    const today = new Date().toISOString().slice(0, 10);
    const salt = process.env.DAILY_SALT || 'sitepulse-secret-salt';
    const sessionHash = crypto
      .createHash('sha256')
      .update(`${site.id}-${ip}-${userAgent}-${today}-${salt}`)
      .digest('hex');

    const event = await prisma.analyticsEvent.create({
      data: {
        siteId: site.id,
        sessionHash,
        pathname,
        referrer: referrer || null,
        browser: browser || null,
        os: os || null,
        deviceType: deviceType || 'desktop'
      }
    });

    res.status(201).json({ success: true, eventId: event.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Protected: Get Analytics Summary
app.get('/api/v1/events/stats', authMiddleware, async (req, res) => {
  try {
    const { siteKey } = req.query;
    if (!siteKey) return res.status(400).json({ error: 'Missing siteKey' });

    const site = await prisma.site.findUnique({ where: { apiKey: siteKey } });
    if (!site) return res.status(404).json({ error: 'Site not found' });

    const totalPageviews = await prisma.analyticsEvent.count({ where: { siteId: site.id } });
    const events = await prisma.analyticsEvent.findMany({
      where: { siteId: site.id },
      select: { sessionHash: true, pathname: true, referrer: true, browser: true, deviceType: true }
    });

    const uniqueSessions = new Set(events.map(e => e.sessionHash)).size;
    const pageCounts = {};
    events.forEach(e => {
      pageCounts[e.pathname] = (pageCounts[e.pathname] || 0) + 1;
    });

    const topPages = Object.entries(pageCounts)
      .map(([path, count]) => ({ path, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    res.json({
      totalPageviews,
      uniqueVisitors: uniqueSessions,
      topPages
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// UNIFIED PRODUCTION DASHBOARD SERVING (Single-Port Setup)
// -------------------------------------------------------------
const dashboardDist = path.join(__dirname, '../../dashboard/dist');
app.use(express.static(dashboardDist));

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/widget') || req.path.startsWith('/demo') || req.path === '/sitepulse.js') {
    return next();
  }
  res.sendFile(path.join(dashboardDist, 'index.html'));
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
