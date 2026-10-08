const express = require('express');
const router = express.Router();
const prisma = require('../db');
const { authMiddleware } = require('../middleware/auth');
const { conversationInitLimiter } = require('../middleware/rateLimiter');

// Protected: List conversations for a site (Admin Inbox)
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { siteKey, status } = req.query;
    if (!siteKey) return res.status(400).json({ error: 'siteKey is required' });

    const site = await prisma.site.findUnique({ where: { apiKey: siteKey } });
    if (!site) return res.status(404).json({ error: 'Site not found' });

    const where = { siteId: site.id };
    if (status && status !== 'all') {
      where.status = status;
    }

    const conversations = await prisma.conversation.findMany({
      where,
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

// Public: Initialize or resume a conversation from the widget
router.post('/init', conversationInitLimiter, async (req, res) => {
  try {
    const { siteKey, visitorId, externalId, visitorName, visitorEmail } = req.body;
    if (!siteKey || !visitorId) {
      return res.status(400).json({ error: 'siteKey and visitorId are required' });
    }

    const site = await prisma.site.findUnique({ where: { apiKey: siteKey } });
    if (!site) return res.status(404).json({ error: 'Site not found' });

    // Strict Email Gate Validation
    if (!visitorEmail || typeof visitorEmail !== 'string') {
      return res.status(400).json({ error: 'Email address is required to start a conversation.' });
    }
    const trimmedEmail = visitorEmail.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      return res.status(400).json({ error: 'Please enter a valid email address.' });
    }

    let conversation = null;

    // Search by external ID if identified
    if (externalId) {
      conversation = await prisma.conversation.findFirst({
        where: { siteId: site.id, externalId: String(externalId).trim() },
        include: {
          messages: { orderBy: { createdAt: 'asc' } }
        }
      });
    }

    // Search by visitorEmail if provided
    if (!conversation && visitorEmail) {
      conversation = await prisma.conversation.findFirst({
        where: { siteId: site.id, visitorEmail: trimmedEmail },
        include: {
          messages: { orderBy: { createdAt: 'asc' } }
        }
      });
    }

    // Otherwise search by visitorId
    if (!conversation) {
      conversation = await prisma.conversation.findFirst({
        where: { siteId: site.id, visitorId },
        include: {
          messages: { orderBy: { createdAt: 'asc' } }
        }
      });
    }

    if (conversation) {
      const updateData = {};
      if (visitorName && visitorName !== conversation.visitorName) updateData.visitorName = visitorName;
      if (visitorEmail && visitorEmail !== conversation.visitorEmail) updateData.visitorEmail = trimmedEmail;
      if (externalId && externalId !== conversation.externalId) updateData.externalId = String(externalId).trim();

      if (Object.keys(updateData).length > 0) {
        conversation = await prisma.conversation.update({
          where: { id: conversation.id },
          data: updateData,
          include: {
            messages: { orderBy: { createdAt: 'asc' } }
          }
        });
      }
    } else {
      conversation = await prisma.conversation.create({
        data: {
          siteId: site.id,
          visitorId,
          externalId: externalId ? String(externalId).trim() : null,
          visitorName: visitorName || null,
          visitorEmail: trimmedEmail
        },
        include: {
          messages: true
        }
      });
    }

    res.json(conversation);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Protected: Get messages for a conversation
router.get('/:id/messages', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const conversation = await prisma.conversation.findUnique({
      where: { id },
      include: {
        messages: { orderBy: { createdAt: 'asc' } }
      }
    });

    if (!conversation) return res.status(404).json({ error: 'Conversation not found' });
    res.json(conversation.messages);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Protected: Update Conversation Status (e.g. "open" or "resolved")
router.patch('/:id/status', authMiddleware, async (req, res) => {
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

module.exports = router;
