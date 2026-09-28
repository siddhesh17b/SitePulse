const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../db');
const { authMiddleware, JWT_SECRET } = require('../middleware/auth');

const router = express.Router();

// RFC-compliant email format regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Pre-computed dummy hash to prevent timing-based user enumeration attacks
const DUMMY_HASH = '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy';

// 1. Check if the system has been initialized with an admin
router.get('/status', async (req, res) => {
  try {
    const userCount = await prisma.user.count();
    res.json({
      initialized: userCount > 0
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Signup / Account Creation
router.post('/signup', async (req, res) => {
  try {
    const isFirstUser = (await prisma.user.count()) === 0;

    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required' });
    }

    const trimmedName = String(name).trim();
    const trimmedEmail = String(email).toLowerCase().trim();

    if (!EMAIL_REGEX.test(trimmedEmail)) {
      return res.status(400).json({ error: 'Please enter a valid email address' });
    }

    if (trimmedName.length < 2 || trimmedName.length > 100) {
      return res.status(400).json({ error: 'Name must be between 2 and 100 characters' });
    }

    if (typeof password !== 'string' || password.length < 8 || password.length > 128) {
      return res.status(400).json({ error: 'Password must be between 8 and 128 characters long' });
    }

    const existingUser = await prisma.user.findUnique({
      where: { email: trimmedEmail }
    });

    if (existingUser) {
      return res.status(400).json({ error: 'An account with this email already exists' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const user = await prisma.user.create({
      data: {
        name: trimmedName,
        email: trimmedEmail,
        password: passwordHash,
        role: isFirstUser ? 'admin' : 'agent'
      }
    });

    // Attach demo site to first admin if unassigned
    const demoSite = await prisma.site.findUnique({ where: { apiKey: 'sp_demo_12345' } });
    if (demoSite && !demoSite.userId) {
      await prisma.site.update({
        where: { id: demoSite.id },
        data: { userId: user.id }
      });
    }

    // Generate JWT
    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role, name: user.name },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.status(201).json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const trimmedEmail = String(email).toLowerCase().trim();
    const user = await prisma.user.findUnique({
      where: { email: trimmedEmail }
    });

    // Timing attack mitigation: always execute bcrypt compare
    const hashToCompare = user ? user.password : DUMMY_HASH;
    const isMatch = await bcrypt.compare(String(password), hashToCompare);

    if (!user || !isMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role, name: user.name },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Get Current User Profile (Protected)
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true
      }
    });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
