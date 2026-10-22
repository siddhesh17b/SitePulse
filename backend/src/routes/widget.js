const express = require('express');
const router = express.Router();
const prisma = require('../db');
const { authMiddleware } = require('../middleware/auth');
const { validateBody } = require('../middleware/validate');
const { updateConfigSchema } = require('../schemas/widget.schema');

// Public: Fetched by the embed script to customize itself dynamically on client website
router.get('/config', async (req, res) => {
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
router.put('/config', authMiddleware, validateBody(updateConfigSchema), async (req, res) => {
  try {
    const { siteKey, settings } = req.body;

    const site = await prisma.site.findUnique({ where: { apiKey: siteKey } });
    if (!site) {
      return res.status(404).json({ error: 'Site not found' });
    }

    if (site.userId && site.userId !== req.user.userId) {
      return res.status(403).json({ error: 'Unauthorized to update settings for this site' });
    }

    const updatedSite = await prisma.site.update({
      where: { apiKey: siteKey },
      data: { widgetSettings: settings }
    });

    // Notify any active clients or dashboard of settings update
    if (req.io) {
      req.io.to(`site_${siteKey}`).emit('widget_settings_updated', settings);
    }

    res.json({ success: true, settings: updatedSite.widgetSettings });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
