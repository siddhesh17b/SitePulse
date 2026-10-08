const express = require('express');
const router = express.Router();
const prisma = require('../db');
const { authMiddleware } = require('../middleware/auth');

// Public: Visitor submits bug report with optional diagnostics
router.post('/', async (req, res) => {
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
        device: device || null,
        status: 'new'
      }
    });

    // Notify admin
    if (req.io) {
      req.io.to(`site_${siteKey}`).emit('new_bug_received', bug);
    }

    res.status(201).json({ success: true, bug });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Protected: Admin views bug reports for a site
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { siteKey } = req.query;
    if (!siteKey) return res.status(400).json({ error: 'siteKey is required' });

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

module.exports = router;
