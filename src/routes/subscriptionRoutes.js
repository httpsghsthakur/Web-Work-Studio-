const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { logAudit } = require('../middleware/auditLogger');

// GET /api/v1/plans - List all subscription plans
router.get('/', authenticateToken, (req, res) => {
  try {
    const plans = db.all('SELECT * FROM subscription_plans ORDER BY tier_level ASC');
    const plansWithCounts = plans.map(p => {
      const schCount = db.get('SELECT COUNT(*) as cnt FROM schools WHERE plan_id = ?', p.id);
      return {
        ...p,
        active_schools_count: schCount ? schCount.cnt : 0,
        features: JSON.parse(p.features_json || '[]'),
        modules: JSON.parse(p.modules_json || '[]')
      };
    });

    res.json({ success: true, data: plansWithCounts });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/v1/plans - Create a new subscription plan
router.post('/', authenticateToken, requireRole(['SUPER_ADMIN', 'FINANCE_OFFICER']), (req, res) => {
  try {
    const {
      name, code, description, monthly_price, annual_price,
      max_students = 1000, max_teachers = 80, max_storage_gb = 50,
      features = [], modules = ['admissions', 'attendance', 'fees']
    } = req.body;

    if (!name || !code || !monthly_price || !annual_price) {
      return res.status(400).json({ success: false, error: 'Name, code, monthly_price, and annual_price are required' });
    }

    const planId = `plan-${code.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;

    db.run(`
      INSERT INTO subscription_plans (
        id, code, name, description, tier_level, monthly_price, annual_price,
        max_students, max_teachers, max_storage_gb, features_json, modules_json
      ) VALUES (?, ?, ?, ?, 2, ?, ?, ?, ?, ?, ?, ?)
    `,
      planId, code.toUpperCase().trim(), name.trim(), description || '',
      parseFloat(monthly_price), parseFloat(annual_price),
      parseInt(max_students, 10), parseInt(max_teachers, 10), parseInt(max_storage_gb, 10),
      JSON.stringify(features), JSON.stringify(modules)
    );

    logAudit({
      userId: req.user.id,
      userEmail: req.user.email,
      action: 'CREATE_SUBSCRIPTION_PLAN',
      targetType: 'PLAN',
      targetId: planId,
      details: { name, code, monthly_price, annual_price },
      ip: req.ip
    });

    res.status(201).json({ success: true, message: 'Plan created successfully', planId });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/v1/plans/:id - Update plan pricing/features
router.put('/:id', authenticateToken, requireRole(['SUPER_ADMIN', 'FINANCE_OFFICER']), (req, res) => {
  try {
    const { name, description, monthly_price, annual_price, max_students, max_teachers, features, modules, is_active } = req.body;

    db.run(`
      UPDATE subscription_plans SET
        name = COALESCE(?, name),
        description = COALESCE(?, description),
        monthly_price = COALESCE(?, monthly_price),
        annual_price = COALESCE(?, annual_price),
        max_students = COALESCE(?, max_students),
        max_teachers = COALESCE(?, max_teachers),
        features_json = COALESCE(?, features_json),
        modules_json = COALESCE(?, modules_json),
        is_active = COALESCE(?, is_active)
      WHERE id = ?
    `,
      name, description, monthly_price, annual_price, max_students, max_teachers,
      features ? JSON.stringify(features) : null,
      modules ? JSON.stringify(modules) : null,
      is_active,
      req.params.id
    );

    res.json({ success: true, message: 'Plan updated successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
