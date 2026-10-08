const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const prisma = require('../db');
const { authMiddleware } = require('../middleware/auth');

// Public: Beacon sent from widget to track pageview (cookieless session hash)
router.post('/', async (req, res) => {
  try {
    const { siteKey, pathname, referrer, browser, os, deviceType } = req.body;
    if (!siteKey || !pathname) {
      return res.status(400).json({ error: 'siteKey and pathname are required' });
    }

    const site = await prisma.site.findUnique({ where: { apiKey: siteKey } });
    if (!site) return res.status(404).json({ error: 'Site not found' });

    // Generate cookieless daily session hash using IP + User-Agent + Salt + Date
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
    const userAgent = req.headers['user-agent'] || 'unknown';
    const dateStr = new Date().toISOString().slice(0, 10);
    const salt = process.env.JWT_SECRET || 'sitepulse_privacy_salt';

    const sessionHash = crypto
      .createHash('sha256')
      .update(`${ip}-${userAgent}-${salt}-${dateStr}`)
      .digest('hex');

    const event = await prisma.analyticsEvent.create({
      data: {
        siteId: site.id,
        sessionHash,
        pathname,
        referrer: referrer || null,
        browser: browser || null,
        os: os || null,
        deviceType: deviceType || null
      }
    });

    res.status(201).json({ success: true, eventId: event.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Protected: Aggregate analytics summary for a site
router.get('/stats', authMiddleware, async (req, res) => {
  try {
    const { siteKey } = req.query;
    if (!siteKey) return res.status(400).json({ error: 'siteKey is required' });

    const site = await prisma.site.findUnique({ where: { apiKey: siteKey } });
    if (!site) return res.status(404).json({ error: 'Site not found' });

    const totalPageviews = await prisma.analyticsEvent.count({
      where: { siteId: site.id }
    });

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

module.exports = router;
