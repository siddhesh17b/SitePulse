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
  // Admin or Visitor joins site-wide configuration room
  socket.on('join_site_admin', ({ siteKey }) => {
    if (siteKey) {
      socket.join(`site_${siteKey}`);
    }
  });

  socket.on('join_site', ({ siteKey }) => {
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
      if (!conversationId || !content || typeof content !== 'string') return;
      const trimmed = content.trim();
      if (trimmed.length === 0 || trimmed.length > 5000) return;

      // Ensure socket is joined to the conversation room
      socket.join(`conv_${conversationId}`);

      let savedMessage = null;
      if (prisma) {
        savedMessage = await prisma.message.create({
          data: {
            conversationId,
            senderType: senderType || 'visitor',
            senderName: senderName || (senderType === 'agent' ? 'Support Agent' : 'Visitor'),
            content: trimmed
          }
        });

        // Update conversation lastMessageAt and reopen status if visitor sends message
        await prisma.conversation.update({
          where: { id: conversationId },
          data: {
            lastMessageAt: new Date(),
            status: senderType === 'visitor' ? 'open' : undefined
          }
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
      requireEmail: true
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

// Protected: Update website name or domain/URL without losing data or changing siteKey
const handleUpdateSite = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, domain } = req.body;

    if (!name && !domain) {
      return res.status(400).json({ error: 'At least name or domain must be provided.' });
    }

    const site = await prisma.site.findUnique({ where: { id } });
    if (!site) {
      return res.status(404).json({ error: 'Site not found.' });
    }

    // Verify ownership
    if (site.userId && site.userId !== req.user.userId) {
      return res.status(403).json({ error: 'Unauthorized to update this website property.' });
    }

    const updatedData = {};
    if (name && name.trim()) updatedData.name = name.trim();
    if (domain && domain.trim()) updatedData.domain = domain.trim();

    const updatedSite = await prisma.site.update({
      where: { id },
      data: updatedData
    });

    res.json({
      success: true,
      message: 'Website property updated successfully.',
      site: updatedSite
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

app.patch('/api/v1/sites/:id', authMiddleware, handleUpdateSite);
app.put('/api/v1/sites/:id', authMiddleware, handleUpdateSite);

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

// -------------------------------------------------------------
// PAGE TARGETING & AUTO-DISCOVERY API
// -------------------------------------------------------------

function normalizePathname(urlOrPath, baseOrigin) {
  try {
    if (!urlOrPath) return '/';
    let path = urlOrPath.trim();
    if (path.startsWith('http://') || path.startsWith('https://')) {
      const u = new URL(path);
      path = u.pathname;
    } else if (path.startsWith('//')) {
      const u = new URL('http:' + path);
      path = u.pathname;
    } else if (baseOrigin && !path.startsWith('/')) {
      const u = new URL(path, baseOrigin);
      path = u.pathname;
    }
    path = path.split('?')[0].split('#')[0];
    if (!path.startsWith('/')) path = '/' + path;
    path = path.replace(/\/+/g, '/');
    if (path.length > 1 && path.endsWith('/')) {
      path = path.slice(0, -1);
    }
    return path.toLowerCase();
  } catch (e) {
    return '/';
  }
}

// Protected: Get all discovered and traffic-recorded pages for a site
app.get('/api/v1/sites/:siteKey/pages', authMiddleware, async (req, res) => {
  try {
    const { siteKey } = req.params;
    const site = await prisma.site.findUnique({ where: { apiKey: siteKey } });
    if (!site) return res.status(404).json({ error: 'Site not found' });

    // 1. Get distinct pages from recent analytics events (capped for performance)
    const events = await prisma.analyticsEvent.findMany({
      where: { siteId: site.id },
      select: { pathname: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 2000
    });

    const pageMap = new Map();

    // Always include root /
    pageMap.set('/', {
      path: '/',
      source: 'root',
      lastSeen: new Date().toISOString(),
      views: 0
    });

    events.forEach(e => {
      const clean = normalizePathname(e.pathname);
      if (!pageMap.has(clean)) {
        pageMap.set(clean, {
          path: clean,
          source: 'traffic',
          lastSeen: e.createdAt,
          views: 1
        });
      } else {
        const item = pageMap.get(clean);
        item.views = (item.views || 0) + 1;
        if (new Date(e.createdAt) > new Date(item.lastSeen)) {
          item.lastSeen = e.createdAt;
        }
      }
    });

    // 2. Add crawler-discovered pages from widgetSettings
    const settings = site.widgetSettings || {};
    const pageRules = settings.pageRules || {
      enabled: true,
      defaultPolicy: 'allow',
      rules: {}
    };

    if (Array.isArray(pageRules.discoveredPages)) {
      pageRules.discoveredPages.forEach(p => {
        const pathStr = typeof p === 'string' ? p : p.path;
        const clean = normalizePathname(pathStr);
        if (!pageMap.has(clean)) {
          pageMap.set(clean, {
            path: clean,
            source: (typeof p === 'object' && p.source) || 'crawler',
            lastSeen: (typeof p === 'object' && p.lastSeen) || site.createdAt,
            views: 0
          });
        }
      });
    }

    // 3. Add any custom rules configured by the user
    if (pageRules.rules && typeof pageRules.rules === 'object') {
      Object.keys(pageRules.rules).forEach(rulePath => {
        const clean = rulePath.trim().toLowerCase();
        if (!pageMap.has(clean)) {
          pageMap.set(clean, {
            path: clean,
            source: 'custom_rule',
            lastSeen: site.createdAt,
            views: 0
          });
        }
      });
    }

    const pages = Array.from(pageMap.values()).sort((a, b) => {
      if (a.path === '/') return -1;
      if (b.path === '/') return 1;
      return a.path.localeCompare(b.path);
    });

    res.json({
      siteKey: site.apiKey,
      siteDomain: site.domain,
      pages,
      pageRules: {
        enabled: pageRules.enabled !== false,
        defaultPolicy: pageRules.defaultPolicy || 'allow',
        rules: pageRules.rules || {}
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Protected: Scan Website Domain for Pages (HTML crawler + sitemap)
app.post('/api/v1/sites/:siteKey/scan', authMiddleware, async (req, res) => {
  try {
    const { siteKey } = req.params;
    const site = await prisma.site.findUnique({ where: { apiKey: siteKey } });
    if (!site) return res.status(404).json({ error: 'Site not found' });

    let rawDomain = (site.domain || '').trim();
    if (!rawDomain) {
      return res.status(400).json({ error: 'Site domain is not configured.' });
    }

    let targetUrl;
    if (rawDomain.startsWith('http://') || rawDomain.startsWith('https://')) {
      targetUrl = rawDomain;
    } else if (rawDomain.startsWith('localhost') || rawDomain.startsWith('127.0.0.1')) {
      targetUrl = `http://${rawDomain}`;
    } else {
      targetUrl = `https://${rawDomain}`;
    }

    try {
      const parsed = new URL(targetUrl);
      const h = parsed.hostname.toLowerCase();
      if (h.startsWith('169.254.') || h === 'metadata.google.internal' || h === '0.0.0.0' || h === '[::1]' || h === '::1') {
        return res.status(400).json({ error: 'Scanning internal link-local or metadata addresses is restricted for security.' });
      }
    } catch (e) {
      return res.status(400).json({ error: 'Invalid site domain URL format.' });
    }

    const MAX_FETCHES = 25;
    const MAX_DISCOVERED_PAGES = 100;
    const discoveredSet = new Set(['/']);
    const visitedUrls = new Set();
    const queue = [targetUrl];
    const issues = [];
    const parsedTarget = new URL(targetUrl);
    const targetOrigin = parsedTarget.origin.toLowerCase();

    // 1. Multi-level BFS Crawl of internal links
    while (queue.length > 0 && visitedUrls.size < MAX_FETCHES && discoveredSet.size < MAX_DISCOVERED_PAGES) {
      const currentUrl = queue.shift();
      if (visitedUrls.has(currentUrl)) continue;
      visitedUrls.add(currentUrl);

      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 4000);
        const resp = await fetch(currentUrl, {
          signal: controller.signal,
          headers: {
            'User-Agent': 'SitePulse-Bot/1.0 (+http://localhost:5000)'
          }
        });
        clearTimeout(timeout);

        if (!resp.ok) {
          if (visitedUrls.size === 1) {
            issues.push(`HTTP ${resp.status} on ${currentUrl}`);
          }
          continue;
        }

        const cl = parseInt(resp.headers.get('content-length') || '0', 10);
        if (cl > 2 * 1024 * 1024) {
          continue;
        }

        const contentType = resp.headers.get('content-type') || '';
        if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
          continue;
        }

        const html = await resp.text();
        const linkRegex = /(?:href|to)\s*=\s*(?:["']([^"']+)["']|([^\s>]+))/gi;
        let match;
        while ((match = linkRegex.exec(html)) !== null && discoveredSet.size < MAX_DISCOVERED_PAGES) {
          const href = (match[1] || match[2] || '').trim();
          if (
            !href ||
            (href.startsWith('#') && !href.startsWith('#/')) ||
            href === '#' ||
            href.startsWith('mailto:') ||
            href.startsWith('tel:') ||
            href.startsWith('javascript:') ||
            href.startsWith('data:')
          ) {
            continue;
          }

          if (href.startsWith('#/')) {
            discoveredSet.add(href);
            continue;
          }

          if (/\.(png|jpg|jpeg|gif|webp|svg|css|js|woff|woff2|ttf|ico|pdf|zip|xml|json|txt|mp4|webm|mp3|wav|ogg)$/i.test(href)) {
            continue;
          }

          try {
            const resolved = new URL(href, currentUrl);
            if (resolved.origin.toLowerCase() === targetOrigin) {
              const cleanPath = normalizePathname(resolved.pathname);
              discoveredSet.add(cleanPath);
              const fullNormalizedUrl = resolved.origin + cleanPath;
              if (
                !visitedUrls.has(fullNormalizedUrl) &&
                !queue.includes(fullNormalizedUrl) &&
                visitedUrls.size + queue.length < MAX_FETCHES
              ) {
                queue.push(fullNormalizedUrl);
              }
            }
          } catch (e) {}
        }
      } catch (err) {
        if (visitedUrls.size === 1) {
          issues.push(`Fetch failed for ${currentUrl}: ${err.message}`);
        }
      }
    }

    // If scanning local demo or root, also test common HTML demo endpoints
    if (targetUrl.includes('demo2') || rawDomain.includes('demo2')) {
      const baseDemo = targetUrl.replace(/\/+$/, '');
      const demoEndpoints = ['/index.html', '/tables.html', '/alerts.html', '/profile.html'];
      demoEndpoints.forEach(ep => discoveredSet.add(ep));
    }

    // 2. Discover Sitemaps (including robots.txt and sitemap index files)
    const sitemapCandidates = [
      new URL('/sitemap.xml', targetUrl).href,
      new URL('/sitemap_index.xml', targetUrl).href
    ];

    try {
      const robotsUrl = new URL('/robots.txt', targetUrl).href;
      const rCtrl = new AbortController();
      const rTimeout = setTimeout(() => rCtrl.abort(), 3000);
      const rResp = await fetch(robotsUrl, { signal: rCtrl.signal }).catch(() => null);
      clearTimeout(rTimeout);
      if (rResp && rResp.ok) {
        const rTxt = await rResp.text();
        const smRegex = /sitemap:\s*(https?:\/\/[^\s\r\n]+)/gi;
        let smMatch;
        while ((smMatch = smRegex.exec(rTxt)) !== null) {
          if (!sitemapCandidates.includes(smMatch[1].trim())) {
            sitemapCandidates.push(smMatch[1].trim());
          }
        }
      }
    } catch (e) {}

    for (const smUrl of sitemapCandidates) {
      if (discoveredSet.size >= MAX_DISCOVERED_PAGES) break;
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 3500);
        const smResp = await fetch(smUrl, { signal: controller.signal }).catch(() => null);
        clearTimeout(timeout);
        if (!smResp || !smResp.ok) continue;

        const xml = await smResp.text();
        const isSitemapIndex = xml.includes('<sitemapindex') || xml.includes('<sitemap>');
        const locRegex = /<loc>(https?:\/\/[^<]+)<\/loc>/gi;
        let m;

        if (isSitemapIndex) {
          const childSitemaps = [];
          while ((m = locRegex.exec(xml)) !== null && childSitemaps.length < 3) {
            childSitemaps.push(m[1].trim());
          }
          for (const childUrl of childSitemaps) {
            if (discoveredSet.size >= MAX_DISCOVERED_PAGES) break;
            try {
              const cCtrl = new AbortController();
              const cTimeout = setTimeout(() => cCtrl.abort(), 3000);
              const cResp = await fetch(childUrl, { signal: cCtrl.signal }).catch(() => null);
              clearTimeout(cTimeout);
              if (cResp && cResp.ok) {
                const cXml = await cResp.text();
                const cLocRegex = /<loc>(https?:\/\/[^<]+)<\/loc>/gi;
                let cm;
                while ((cm = cLocRegex.exec(cXml)) !== null && discoveredSet.size < MAX_DISCOVERED_PAGES) {
                  try {
                    const locUrl = new URL(cm[1].trim());
                    if (locUrl.origin.toLowerCase() === targetOrigin && !locUrl.pathname.endsWith('.xml')) {
                      discoveredSet.add(normalizePathname(locUrl.pathname));
                    }
                  } catch (e) {}
                }
              }
            } catch (e) {}
          }
        } else {
          while ((m = locRegex.exec(xml)) !== null && discoveredSet.size < MAX_DISCOVERED_PAGES) {
            try {
              const locUrl = new URL(m[1].trim());
              if (locUrl.origin.toLowerCase() === targetOrigin && !locUrl.pathname.endsWith('.xml')) {
                discoveredSet.add(normalizePathname(locUrl.pathname));
              }
            } catch (e) {}
          }
        }
      } catch (e) {}
    }

    const newDiscoveredPages = Array.from(discoveredSet).map(p => ({
      path: p,
      source: 'crawler',
      lastSeen: new Date().toISOString()
    }));

    const currentSettings = site.widgetSettings || {};
    const currentPageRules = currentSettings.pageRules || {
      enabled: true,
      defaultPolicy: 'allow',
      rules: {}
    };

    const existingDiscovered = Array.isArray(currentPageRules.discoveredPages)
      ? currentPageRules.discoveredPages
      : [];

    const mergedDiscoveredMap = new Map();
    existingDiscovered.forEach(p => {
      const pathStr = typeof p === 'string' ? p : p.path;
      mergedDiscoveredMap.set(pathStr, p);
    });
    newDiscoveredPages.forEach(p => {
      mergedDiscoveredMap.set(p.path, p);
    });

    const updatedPageRules = {
      ...currentPageRules,
      discoveredPages: Array.from(mergedDiscoveredMap.values())
    };

    const updatedSettings = {
      ...currentSettings,
      pageRules: updatedPageRules
    };

    await prisma.site.update({
      where: { apiKey: siteKey },
      data: { widgetSettings: updatedSettings }
    });

    res.json({
      success: true,
      count: newDiscoveredPages.length,
      pages: newDiscoveredPages,
      issues: issues.length > 0 ? issues : undefined
    });
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

    if (!visitorEmail && !externalId) {
      return res.status(400).json({ error: 'A valid email address is required to start a conversation' });
    }

    const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (visitorEmail && !EMAIL_REGEX.test(String(visitorEmail).trim().toLowerCase())) {
      return res.status(400).json({ error: 'Please enter a valid email address' });
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
