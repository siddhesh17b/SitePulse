const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const prisma = require('../db');
const { authMiddleware } = require('../middleware/auth');

// Utility: Normalize pathnames consistently across crawler and analytics
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

// -------------------------------------------------------------
// SITES CRUD & SETTINGS
// -------------------------------------------------------------

// Protected: List Sites for authenticated admin
router.get('/', authMiddleware, async (req, res) => {
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

// Protected: Create Site
router.post('/', authMiddleware, async (req, res) => {
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

// Handler for updating website name or domain/URL
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

router.patch('/:id', authMiddleware, handleUpdateSite);
router.put('/:id', authMiddleware, handleUpdateSite);

// Protected: Delete a Site (Requires Admin Password)
router.delete('/:id', authMiddleware, async (req, res) => {
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
router.delete('/:id/conversations', authMiddleware, async (req, res) => {
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
    if (req.io) {
      req.io.to(`site_${site.apiKey}`).emit('all_conversations_deleted', { siteId: id });
    }

    res.json({
      success: true,
      message: `Successfully deleted ${deletedConvs.count} conversation(s).`,
      count: deletedConvs.count
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Protected: Update Widget Customization Settings by Site ID
router.put('/:id/settings', authMiddleware, async (req, res) => {
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
    if (req.io) {
      req.io.to(`site_${site.apiKey}`).emit('widget_settings_updated', settings);
    }

    res.json({ success: true, settings: updatedSite.widgetSettings });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// PAGE RULES & WEB CRAWLER DISCOVERY
// -------------------------------------------------------------

// Protected: Get all discovered and traffic-recorded pages for a site
router.get('/:siteKey/pages', authMiddleware, async (req, res) => {
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
router.post('/:siteKey/scan', authMiddleware, async (req, res) => {
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
    const parsedTarget = new URL(targetUrl);
    const targetOrigin = parsedTarget.origin.toLowerCase();
    const discoveredSet = new Set(['/']);
    if (parsedTarget.pathname && parsedTarget.pathname !== '/') {
      discoveredSet.add(normalizePathname(parsedTarget.pathname));
    }
    const visitedUrls = new Set();
    const rootUrl = targetOrigin + '/';
    const queue = [targetUrl];
    if (targetUrl !== rootUrl && !queue.includes(rootUrl)) {
      queue.push(rootUrl);
    }
    const issues = [];

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

module.exports = router;
