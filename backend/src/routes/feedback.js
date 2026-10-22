const express = require('express');
const router = express.Router();
const prisma = require('../db');
const { authMiddleware } = require('../middleware/auth');
const { validateBody } = require('../middleware/validate');
const { createFeedbackSchema } = require('../schemas/feedback.schema');

// Public: Visitor submits feedback rating + comment from widget
router.post('/', validateBody(createFeedbackSchema), async (req, res) => {
  try {
    const { siteKey, rating, comment, userEmail } = req.body;

    const site = await prisma.site.findUnique({ where: { apiKey: siteKey } });
    if (!site) return res.status(404).json({ error: 'Site not found' });

    const feedback = await prisma.feedback.create({
      data: {
        siteId: site.id,
        rating,
        comment,
        userEmail: userEmail || null
      }
    });

    // Notify admin
    if (req.io) {
      req.io.to(`site_${siteKey}`).emit('new_feedback_received', feedback);
    }

    res.status(201).json({ success: true, feedback });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Protected: Admin views feedback for a site
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { siteKey } = req.query;
    if (!siteKey) return res.status(400).json({ error: 'siteKey is required' });

    const site = await prisma.site.findUnique({ where: { apiKey: siteKey } });
    if (!site) return res.status(404).json({ error: 'Site not found' });
    if (site.userId && site.userId !== req.user.userId) {
      return res.status(403).json({ error: 'Unauthorized to view feedback for this site' });
    }

    const feedbacks = await prisma.feedback.findMany({
      where: { siteId: site.id },
      orderBy: { createdAt: 'desc' }
    });

    res.json(feedbacks);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
