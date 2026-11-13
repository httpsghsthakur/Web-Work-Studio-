const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { authenticateToken, requireRole } = require('../middleware/auth');
const commandQueueService = require('../services/commandQueueService');

// GET /api/v1/remote-control/commands - List command queue
router.get('/commands', authenticateToken, (req, res) => {
  try {
    const { school_id, status } = req.query;
    let sql = `
      SELECT 
        c.*,
        s.name as school_name,
        s.code as school_code,
        s.erp_url,
        s.status as school_status
      FROM remote_commands c
      JOIN schools s ON c.school_id = s.id
      WHERE 1=1
    `;
    const params = [];

    if (school_id) {
      sql += ' AND c.school_id = ?';
      params.push(school_id);
    }
    if (status) {
      sql += ' AND c.status = ?';
      params.push(status);
    }

    sql += ' ORDER BY c.issued_at DESC LIMIT 50';

    const commands = db.all(sql, ...params);
    res.json({
      success: true,
      count: commands.length,
      data: commands.map(c => ({
        ...c,
        payload: JSON.parse(c.payload_json || '{}')
      }))
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/v1/remote-control/issue - Issue predefined remote command
router.post('/issue', authenticateToken, requireRole(['SUPER_ADMIN', 'OPERATIONS_MANAGER']), (req, res) => {
  try {
    const { school_id, command_type, payload = {}, confirmation } = req.body;

    if (!school_id || !command_type) {
      return res.status(400).json({ success: false, error: 'school_id and command_type are required' });
    }

    // Require explicit confirmation for high-impact suspension command
    if (command_type === 'SUSPEND_SERVICE' && confirmation !== true) {
      return res.status(400).json({
        success: false,
        error: 'High-impact action: SUSPEND_SERVICE requires explicit confirmation: true'
      });
    }

    const result = commandQueueService.enqueueCommand({
      schoolId: school_id,
      commandType: command_type,
      payload,
      issuedBy: req.user.email
    });

    res.status(201).json({
      success: true,
      message: `Predefined remote command ${command_type} enqueued successfully. Pending delivery to school ERP connector.`,
      data: result
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/v1/remote-control/simulate-execution - Instantly simulate connector polling & execution
// (Useful for interactive dashboard demo and verification)
router.post('/simulate-execution', authenticateToken, requireRole(['SUPER_ADMIN']), (req, res) => {
  try {
    const { command_id } = req.body;
    if (!command_id) {
      return res.status(400).json({ success: false, error: 'command_id is required' });
    }

    const cmd = db.get('SELECT * FROM remote_commands WHERE command_id = ?', command_id);
    if (!cmd) {
      return res.status(404).json({ success: false, error: 'Command not found' });
    }

    const payload = JSON.parse(cmd.payload_json || '{}');
    let executionLog = `Simulated execution by ${req.user.email}. Predefined command ${cmd.command_type} verified and applied locally.`;

    if (cmd.command_type === 'SUSPEND_SERVICE') {
      executionLog += ` School ERP user routing locked. Redirection to /service-suspended active. Reason: ${payload.reason || 'Overdue subscription'}. School database remains 100% intact.`;
    } else if (cmd.command_type === 'REACTIVATE_SERVICE') {
      executionLog += ' School ERP resumed. Normal login access restored for all students, teachers, and admins.';
    }

    const ack = commandQueueService.acknowledgeCommand({
      schoolId: cmd.school_id,
      commandId: cmd.command_id,
      executionStatus: 'SUCCESS',
      resultLog: executionLog
    });

    res.json({
      success: true,
      message: 'Command executed and state synchronized successfully.',
      data: ack
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
