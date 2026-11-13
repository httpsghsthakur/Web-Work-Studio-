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

// GET /api/v1/analytics/deep-metrics - Real Deep Business Intelligence & KPI Hub
router.get('/deep-metrics', authenticateToken, (req, res) => {
  try {
    const data = biAnalyticsService.getDeepAnalytics();
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/v1/analytics/reports/financial - Live Financial Ledger Breakdown
router.get('/reports/financial', authenticateToken, (req, res) => {
  try {
    const rows = biAnalyticsService.getFinancialLedger();
    res.json({ success: true, count: rows.length, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/v1/analytics/reports/census - Live Academic Census & Capacity Report
router.get('/reports/census', authenticateToken, (req, res) => {
  try {
    const rows = biAnalyticsService.getAcademicCensusReport();
    res.json({ success: true, count: rows.length, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/v1/analytics/reports/security - Centralized Security & Compliance Audit
router.get('/reports/security', authenticateToken, (req, res) => {
  try {
    const rows = biAnalyticsService.getSecurityAuditReport();
    res.json({ success: true, count: rows.length, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/v1/analytics/export - Export comprehensive real data as CSV or JSON
router.get('/export', authenticateToken, (req, res) => {
  try {
    const { type = 'all' } = req.query;
    const dateStr = new Date().toISOString().slice(0, 10);

    // 1. JSON Export Bundle
    if (type === 'json') {
      const deep = biAnalyticsService.getDeepAnalytics();
      const financial = biAnalyticsService.getFinancialLedger();
      const census = biAnalyticsService.getAcademicCensusReport();
      const security = biAnalyticsService.getSecurityAuditReport();

      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="central_command_full_bi_bundle_${dateStr}.json"`);
      return res.json({
        platform: 'CENTRAL ERP COMMAND',
        exportDate: new Date().toISOString(),
        summaryKpis: deep.kpis,
        wingDistribution: deep.wingDistribution,
        schoolsMatrix: deep.matrix,
        financialLedger: financial,
        academicCensus: census,
        securityEvents: security
      });
    }

    // 2. Financial Ledger CSV
    if (type === 'financial') {
      const ledger = biAnalyticsService.getFinancialLedger();
      const headers = [
        'Invoice Number', 'School Code', 'School Name', 'City', 'Plan', 'Pricing Model',
        'Price Per Student', 'Billing Cycle', 'Period Start', 'Period End', 'Issue Date', 'Due Date',
        'Subtotal (INR)', 'GST Tax 18% (INR)', 'Total Amount (INR)', 'Balance Due (INR)', 'Status',
        'Total Paid (INR)', 'Latest Payment Date', 'Payment Reference / UTR', 'Payment Method'
      ];
      const rows = ledger.map(l => [
        `"${l.invoice_number}"`,
        `"${l.school_code}"`,
        `"${(l.school_name || '').replace(/"/g, '""')}"`,
        `"${l.city || ''}"`,
        `"${l.plan_name || ''}"`,
        `"${l.pricing_model || 'PER_STUDENT'}"`,
        l.price_per_student || 25,
        `"${l.billing_cycle}"`,
        `"${l.period_start || ''}"`,
        `"${l.period_end || ''}"`,
        `"${l.issue_date}"`,
        `"${l.due_date}"`,
        l.subtotal,
        l.tax_amount,
        l.total_amount,
        l.balance_due,
        `"${l.invoice_status}"`,
        l.total_payments,
        `"${l.latest_payment_date || 'N/A'}"`,
        `"${l.latest_payment_reference || 'N/A'}"`,
        `"${l.latest_payment_method || 'N/A'}"`
      ]);

      const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="financial_subscription_ledger_${dateStr}.csv"`);
      return res.send(csvContent);
    }

    // 3. Academic Census & Capacity CSV
    if (type === 'census') {
      const census = biAnalyticsService.getAcademicCensusReport();
      const headers = [
        'School Code', 'School Name', 'City', 'State', 'Operational Status', 'Plan', 'Pricing Model',
        'Price Per Student', 'Total Students', 'Active Students', 'Inactive Students', 'Recent Admissions',
        'Departed / Transferred', 'Total Teachers', 'Active Teachers', 'Non-Teaching Staff', 'Student/Teacher Ratio',
        'Daily Attendance %', 'Daily Active Logins', 'Storage (MB)', 'Primary Wing', 'Middle Wing', 'Secondary Wing', 'Senior Secondary', 'Last Sync'
      ];
      const rows = census.map(c => [
        `"${c.school_code}"`,
        `"${(c.school_name || '').replace(/"/g, '""')}"`,
        `"${c.city || ''}"`,
        `"${c.state || ''}"`,
        `"${c.operational_status}"`,
        `"${c.plan_name || ''}"`,
        `"${c.pricing_model}"`,
        c.price_per_student || 25,
        c.total_students,
        c.active_students,
        c.inactive_students,
        c.recent_admissions,
        c.departed_students,
        c.total_teachers,
        c.active_teachers,
        c.non_teaching_staff,
        c.student_teacher_ratio,
        c.attendance_rate,
        c.daily_active_logins,
        c.storage_used_mb,
        c.class_distribution['Primary Wing (Grades 1-5)'] || c.class_distribution['Grade 1-5'] || 0,
        c.class_distribution['Middle Wing (Grades 6-8)'] || c.class_distribution['Grade 6-8'] || 0,
        c.class_distribution['Secondary Wing (Grades 9-10)'] || c.class_distribution['Grade 9-10'] || 0,
        c.class_distribution['Senior Secondary (Grades 11-12)'] || c.class_distribution['Grade 11-12'] || 0,
        `"${c.sync_timestamp || 'Never'}"`
      ]);

      const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="academic_census_capacity_report_${dateStr}.csv"`);
      return res.send(csvContent);
    }

    // 4. Security & Compliance Audit CSV
    if (type === 'security') {
      const security = biAnalyticsService.getSecurityAuditReport();
      const headers = [
        'Timestamp', 'School Code', 'School Name', 'Event Type', 'Severity', 'User Identifier', 'IP Address', 'Description', 'Source ERP'
      ];
      const rows = security.map(e => [
        `"${e.created_at}"`,
        `"${e.school_code || 'CENTRAL'}"`,
        `"${(e.school_name || 'Central Command').replace(/"/g, '""')}"`,
        `"${e.event_type}"`,
        `"${e.severity}"`,
        `"${e.user_identifier || 'SYSTEM'}"`,
        `"${e.ip_address || '127.0.0.1'}"`,
        `"${(e.description || '').replace(/"/g, '""')}"`,
        `"${e.source_erp}"`
      ]);

      const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="security_compliance_audit_${dateStr}.csv"`);
      return res.send(csvContent);
    }

    // 5. Default: Master Comparative Matrix CSV
    const matrix = biAnalyticsService.getComparativeAnalytics();
    const headers = [
      'School Code',
      'School Name',
      'City',
      'State',
      'Operational Status',
      'Payment Status',
      'Plan',
      'Pricing Model',
      'Price Per Student (INR)',
      'Billing Cycle',
      'Total Students',
      'Active Students',
      'Recent Admissions',
      'Total Teachers',
      'Staff',
      'Student/Teacher Ratio',
      'Attendance Rate %',
      'Daily Active Logins',
      'Storage MB',
      'Total Invoiced (INR)',
      'Total Paid (INR)',
      'Outstanding Balance (INR)',
      'Collection Efficiency %',
      'Health Status',
      'Approval Status',
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
      `"${s.pricing_model || 'PER_STUDENT'}"`,
      s.price_per_student || 25,
      `"${s.billing_cycle}"`,
      s.students,
      s.active_students,
      s.recent_admissions,
      s.teachers,
      s.staff,
      s.student_teacher_ratio,
      s.attendance_rate,
      s.daily_logins,
      s.storage_mb,
      s.total_invoiced,
      s.total_paid,
      s.outstanding_balance,
      s.collection_efficiency,
      `"${s.health_status}"`,
      `"${s.approval_status || 'APPROVED'}"`,
      `"${s.last_sync_at || 'Never'}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="school_master_comparative_bi_report_${dateStr}.csv"`);
    res.send(csvContent);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
