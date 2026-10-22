const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const prisma = require('../db');
const { authMiddleware } = require('../middleware/auth');
const { validateBody } = require('../middleware/validate');
const { trackEventSchema } = require('../schemas/events.schema');

// Public: Beacon sent from widget to track pageview (cookieless session hash)
router.post('/', validateBody(trackEventSchema), async (req, res) => {
  try {
    const { siteKey, pathname, referrer, browser, os, deviceType } = req.body;

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

// Protected: Aggregate analytics summary for a site (Database Query Aggregation)
router.get('/stats', authMiddleware, async (req, res) => {
  try {
    const { siteKey } = req.query;
    if (!siteKey) return res.status(400).json({ error: 'siteKey is required' });

    const site = await prisma.site.findUnique({ where: { apiKey: siteKey } });
    if (!site) return res.status(404).json({ error: 'Site not found' });
    if (site.userId && site.userId !== req.user.userId) {
      return res.status(403).json({ error: 'Unauthorized to view analytics for this site' });
    }

    const totalPageviews = await prisma.analyticsEvent.count({
      where: { siteId: site.id }
    });

    // Database-level grouping for top visited pages
    const groupedPages = await prisma.analyticsEvent.groupBy({
      by: ['pathname'],
      where: { siteId: site.id },
      _count: { pathname: true },
      orderBy: { _count: { pathname: 'desc' } },
      take: 5
    });

    const topPages = groupedPages.map((g) => ({
      path: g.pathname,
      count: g._count.pathname
    }));

    // Database-level grouping for unique daily visitor sessions
    const groupedSessions = await prisma.analyticsEvent.groupBy({
      by: ['sessionHash'],
      where: { siteId: site.id }
    });
    const uniqueVisitors = groupedSessions.length;

    res.json({
      totalPageviews,
      uniqueVisitors,
      topPages
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
