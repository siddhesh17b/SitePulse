const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');
require('dotenv').config();

const prisma = require('./db');

const app = express();
const server = http.createServer(app);

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
app.use('/demo', express.static(path.join(__dirname, '../../demo-site')));
app.use('/demo1', express.static(path.join(__dirname, '../../demo-site/demo1')));
app.use('/demo2', express.static(path.join(__dirname, '../../demo-site/demo2/src')));


// Socket.IO Setup
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Real-time Chat Gateway
io.on('connection', (socket) => {
  console.log(`[Socket] New connection: ${socket.id}`);

  // Admin joins site-wide monitoring room
  socket.on('join_site_admin', ({ siteKey }) => {
    if (siteKey) {
      socket.join(`site_${siteKey}`);
      console.log(`[Socket] Admin joined room: site_${siteKey}`);
    }
  });

  // Visitor or Agent joins specific conversation room
  socket.on('join_conversation', ({ conversationId }) => {
    if (conversationId) {
      socket.join(`conv_${conversationId}`);
      console.log(`[Socket] Socket ${socket.id} joined conversation: ${conversationId}`);
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

  socket.on('disconnect', () => {
    console.log(`[Socket] Disconnected: ${socket.id}`);
  });
});

// -------------------------------------------------------------
// REST API ROUTES
// -------------------------------------------------------------

// 1. Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date() });
});

// 2. Sites Management
app.get('/api/v1/sites', async (req, res) => {
  try {
    const sites = await prisma.site.findMany({
      orderBy: { createdAt: 'desc' }
    });
    res.json(sites);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/v1/sites', async (req, res) => {
  try {
    const { name, domain } = req.body;
    if (!name || !domain) {
      return res.status(400).json({ error: 'Name and domain are required' });
    }
    const defaultSettings = {
      primaryColor: '#2563eb',
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
        widgetSettings: defaultSettings
      }
    });
    res.status(201).json(site);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Widget Customization / Configuration API
// Fetched by the embed script to customize itself dynamically on client website
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

// Update Widget Customization Settings (called from Admin Dashboard)
app.put('/api/v1/widget/config', async (req, res) => {
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

// 4. Conversations API
app.get('/api/v1/conversations', async (req, res) => {
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

// Find or Create Conversation for a visitor
app.post('/api/v1/conversations/init', async (req, res) => {
  try {
    const { siteKey, visitorId, visitorName, visitorEmail } = req.body;
    if (!siteKey || !visitorId) {
      return res.status(400).json({ error: 'siteKey and visitorId are required' });
    }

    const site = await prisma.site.findUnique({ where: { apiKey: siteKey } });
    if (!site) return res.status(404).json({ error: 'Site not found' });

    // Look for existing open conversation for this visitor
    let conv = await prisma.conversation.findFirst({
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

    if (!conv) {
      conv = await prisma.conversation.create({
        data: {
          siteId: site.id,
          visitorId,
          visitorName: visitorName || 'Visitor',
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

// Get Messages for a specific conversation
app.get('/api/v1/conversations/:id/messages', async (req, res) => {
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

// 5. Feedback API
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

app.get('/api/v1/feedback', async (req, res) => {
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

app.get('/api/v1/bugs', async (req, res) => {
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

// 7. Privacy-Preserving Analytics Ingestion API
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

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`===============================================`);
  console.log(`🚀 SitePulse Backend Server running on port ${PORT}`);
  console.log(`📡 Socket.IO gateway ready`);
  console.log(`📦 Widget served at: http://localhost:${PORT}/sitepulse.js`);
  console.log(`===============================================`);
});
