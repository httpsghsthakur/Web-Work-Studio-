const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { authenticateToken, requireRole } = require('../middleware/auth');

// GET /api/v1/security/events - Centralized security event stream
router.get('/events', authenticateToken, (req, res) => {
  try {
    const { school_id, severity, event_type, limit = 50 } = req.query;

    let sql = `
      SELECT 
        e.*,
        s.name as school_name,
        s.code as school_code
      FROM security_events e
      LEFT JOIN schools s ON e.school_id = s.id
      WHERE 1=1
    `;
    const params = [];

    if (school_id) {
      sql += ' AND e.school_id = ?';
      params.push(school_id);
    }
    if (severity) {
      sql += ' AND e.severity = ?';
      params.push(severity);
    }
    if (event_type) {
      sql += ' AND e.event_type = ?';
      params.push(event_type);
    }

    sql += ' ORDER BY e.created_at DESC LIMIT ?';
    params.push(parseInt(limit, 10));

    const events = db.all(sql, ...params);

    // Summary counts by severity
    const counts = db.get(`
      SELECT 
        SUM(CASE WHEN severity = 'CRITICAL' THEN 1 ELSE 0 END) as critical_count,
        SUM(CASE WHEN severity = 'ERROR' THEN 1 ELSE 0 END) as error_count,
        SUM(CASE WHEN severity = 'WARNING' THEN 1 ELSE 0 END) as warning_count,
        SUM(CASE WHEN severity = 'INFO' THEN 1 ELSE 0 END) as info_count
      FROM security_events
    `);

    res.json({
      success: true,
      counts: counts || { critical_count: 0, error_count: 0, warning_count: 0, info_count: 0 },
      data: events.map(e => ({
        ...e,
        metadata: JSON.parse(e.metadata_json || '{}')
      }))
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/v1/security/audits - Central platform administrative audit trail
router.get('/audits', authenticateToken, (req, res) => {
  try {
    const { action, user_id, limit = 50 } = req.query;
    let sql = 'SELECT * FROM audit_logs WHERE 1=1';
    const params = [];

    if (action) {
      sql += ' AND action = ?';
      params.push(action);
    }
    if (user_id) {
      sql += ' AND user_id = ?';
      params.push(user_id);
    }

    sql += ' ORDER BY created_at DESC LIMIT ?';
    params.push(parseInt(limit, 10));

    const audits = db.all(sql, ...params);
    res.json({
      success: true,
      count: audits.length,
      data: audits.map(a => ({
        ...a,
        details: JSON.parse(a.details_json || '{}')
      }))
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
