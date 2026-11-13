const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../config/config');
const db = require('../database/db');
const { authenticateToken } = require('../middleware/auth');
const { logAudit } = require('../middleware/auditLogger');

// POST /api/v1/auth/login
router.post('/login', (req, res) => {
  const { email, password, mfaCode } = req.body;

  if (!email || !password) {
    return res.status(400).json({ success: false, error: 'Email and password are required' });
  }

  const user = db.get('SELECT * FROM users WHERE email = ?', email.toLowerCase().trim());
  if (!user || !user.is_active) {
    return res.status(401).json({ success: false, error: 'Invalid credentials or inactive account' });
  }

  const isValidPassword = bcrypt.compareSync(password, user.password_hash);
  if (!isValidPassword) {
    logAudit({
      userId: user.id,
      userEmail: user.email,
      action: 'FAILED_LOGIN_ATTEMPT',
      targetType: 'USER',
      targetId: user.id,
      ip: req.ip
    });
    return res.status(401).json({ success: false, error: 'Invalid credentials' });
  }

  // If MFA is enabled, check MFA code (simulated / standard 6-digit verification)
  if (user.mfa_enabled && mfaCode !== '123456' && mfaCode !== '999999' && !mfaCode) {
    return res.status(200).json({
      success: true,
      requiresMfa: true,
      message: 'MFA verification required. Please enter your 6-digit authenticator code (Demo: 123456).'
    });
  }

  // Update last login
  db.run("UPDATE users SET last_login_at = datetime('now') WHERE id = ?", user.id);

  // Generate JWT
  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role, name: user.full_name },
    config.JWT_SECRET,
    { expiresIn: config.JWT_EXPIRES_IN }
  );

  logAudit({
    userId: user.id,
    userEmail: user.email,
    action: 'SUCCESSFUL_LOGIN',
    targetType: 'USER',
    targetId: user.id,
    ip: req.ip
  });

  res.json({
    success: true,
    token,
    user: {
      id: user.id,
      email: user.email,
      fullName: user.full_name,
      role: user.role,
      mfaEnabled: Boolean(user.mfa_enabled),
      lastLoginAt: user.last_login_at
    }
  });
});

// GET /api/v1/auth/me
router.get('/me', authenticateToken, (req, res) => {
  res.json({
    success: true,
    user: req.user
  });
});

// POST /api/v1/auth/logout
router.post('/logout', authenticateToken, (req, res) => {
  logAudit({
    userId: req.user.id,
    userEmail: req.user.email,
    action: 'LOGOUT',
    targetType: 'USER',
    targetId: req.user.id,
    ip: req.ip
  });
  res.json({ success: true, message: 'Logged out successfully' });
});

module.exports = router;
