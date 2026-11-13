const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { authenticateToken, requireRole } = require('../middleware/auth');
const automationEngine = require('../services/automationEngine');

// GET /api/v1/notifications - List notifications
router.get('/', authenticateToken, (req, res) => {
  try {
    const notifications = db.all(`
      SELECT n.*, s.name as school_name, s.code as school_code
      FROM system_notifications n
      LEFT JOIN schools s ON n.school_id = s.id
      ORDER BY n.created_at DESC
      LIMIT 50
    `);

    const unread = db.get('SELECT COUNT(*) as unread_count FROM system_notifications WHERE is_read = 0');

    res.json({
      success: true,
      unreadCount: unread ? unread.unread_count : 0,
      data: notifications
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/v1/notifications/:id/read - Mark notification as read
router.put('/:id/read', authenticateToken, (req, res) => {
  try {
    db.run('UPDATE system_notifications SET is_read = 1 WHERE id = ?', req.params.id);
    res.json({ success: true, message: 'Notification marked as read' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/v1/notifications/read-all - Mark all notifications as read
router.put('/read-all', authenticateToken, (req, res) => {
  try {
    db.run('UPDATE system_notifications SET is_read = 1 WHERE is_read = 0');
    res.json({ success: true, message: 'All notifications marked as read' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/v1/automation/rules - List automation rules
router.get('/rules', authenticateToken, (req, res) => {
  try {
    const rules = db.all('SELECT * FROM automation_rules ORDER BY created_at ASC');
    res.json({
      success: true,
      data: rules.map(r => ({
        ...r,
        conditions: JSON.parse(r.condition_json || '{}')
      }))
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/v1/automation/evaluate - Trigger manual execution of automation rules
router.post('/evaluate', authenticateToken, requireRole(['SUPER_ADMIN', 'OPERATIONS_MANAGER']), (req, res) => {
  try {
    const results = automationEngine.evaluateRules();
    res.json({
      success: true,
      message: 'Automation rules evaluated successfully',
      results
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
