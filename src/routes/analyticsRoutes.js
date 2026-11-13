const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const biAnalyticsService = require('../services/biAnalyticsService');

// GET /api/v1/analytics/overview - SaaS Owner Dashboard KPIs and charts
router.get('/overview', authenticateToken, (req, res) => {
  try {
    const data = biAnalyticsService.getExecutiveDashboard();
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/v1/analytics/comparison - Comparative School Performance Matrix
router.get('/comparison', authenticateToken, (req, res) => {
  try {
    const matrix = biAnalyticsService.getComparativeAnalytics();
    res.json({ success: true, count: matrix.length, data: matrix });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/v1/analytics/export - Export comparative school data as CSV
router.get('/export', authenticateToken, (req, res) => {
  try {
    const matrix = biAnalyticsService.getComparativeAnalytics();

    const headers = [
      'School Code',
      'School Name',
      'City',
      'State',
      'Operational Status',
      'Payment Status',
      'Plan',
      'Billing Cycle',
      'Total Students',
      'Active Students',
      'Recent Admissions',
      'Total Teachers',
      'Staff',
      'Attendance Rate %',
      'Daily Logins',
      'Storage MB',
      'Total Invoiced (INR)',
      'Total Paid (INR)',
      'Outstanding Balance (INR)',
      'Health Status',
      'Last Sync'
    ];

    const rows = matrix.map(s => [
      `"${s.code}"`,
      `"${s.name.replace(/"/g, '""')}"`,
      `"${s.city || ''}"`,
      `"${s.state || ''}"`,
      `"${s.status}"`,
      `"${s.payment_status}"`,
      `"${s.plan_name || ''}"`,
      `"${s.billing_cycle}"`,
      s.students,
      s.active_students,
      s.recent_admissions,
      s.teachers,
      s.staff,
      s.attendance_rate,
      s.daily_logins,
      s.storage_mb,
      s.total_invoiced,
      s.total_paid,
      s.outstanding_balance,
      `"${s.health_status}"`,
      `"${s.last_sync_at || 'Never'}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="school_comparative_bi_report_${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(csvContent);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
