const assert = require('assert');
const db = require('../src/database/db');
const biAnalyticsService = require('../src/services/biAnalyticsService');
const { createTestSchool, deleteTestSchool } = require('./test_helpers');

console.log('--- TEST SUITE 9: DEEP ANALYTICS, ENTERPRISE LEDGERS & EXPORT ENGINE ---');

const schoolId = 'sch-test-deep-bi';
createTestSchool(schoolId, {
  name: 'Apex Heritage International',
  status: 'ACTIVE',
  pricing_model: 'PER_STUDENT',
  price_per_student: 35.0,
  calculated_subscription_amount: 350000,
  billing_cycle: 'YEARLY',
  approval_status: 'APPROVED'
});

const metricId = `met-deep-${Date.now()}`;
const invoiceId = `inv-deep-${Date.now()}`;
const paymentId = `pay-deep-${Date.now()}`;

try {
  // 1. Insert realistic sync metrics
  db.run(`
    INSERT INTO school_sync_metrics (
      id, school_id, total_students, active_students, inactive_students,
      recent_admissions, departed_students, class_distribution_json,
      total_teachers, active_teachers, inactive_teachers,
      non_teaching_staff, recent_staff_hires, attendance_rate_pct,
      daily_active_logins, storage_used_mb, sync_source
    ) VALUES (
      ?, ?, 1200, 1180, 20,
      45, 5, '{"Primary": 400, "Middle": 450, "Senior": 350}',
      75, 72, 3,
      30, 2, 95.8,
      1100, 28000.0, 'CONNECTOR_PUSH'
    )
  `, metricId, schoolId);

  // 2. Insert test invoice & payment
  db.run(`
    INSERT INTO invoices (
      id, school_id, invoice_number, billing_cycle,
      period_start, period_end, issue_date, due_date,
      subtotal, tax_rate, tax_amount, total_amount, balance_due, status
    ) VALUES (
      ?, ?, 'INV-TEST-DEEP-01', 'YEARLY',
      date('now'), date('now', '+1 year'), date('now'), date('now', '+30 days'),
      100000.0, 18.0, 18000.0, 118000.0, 0.0, 'PAID'
    )
  `, invoiceId, schoolId);

  db.run(`
    INSERT INTO payments (
      id, payment_number, invoice_id, school_id, amount, payment_method,
      transaction_reference, notes, status, payment_date
    ) VALUES (
      ?, 'PAY-TEST-DEEP-01', ?, ?, 118000.0, 'BANK_TRANSFER',
      'REF-AXIS-99201', 'Annual subscription settlement', 'SUCCESSFUL', datetime('now')
    )
  `, paymentId, invoiceId, schoolId);

  // 3. Test biAnalyticsService.getComparativeAnalytics()
  const comp = biAnalyticsService.getComparativeAnalytics();
  assert.ok(Array.isArray(comp), 'Comparative analytics must return array');
  const targetSchool = comp.find(s => s.id === schoolId);
  assert.ok(targetSchool, 'Test school must exist in comparative analytics');
  assert.strictEqual(targetSchool.students, 1200);
  assert.strictEqual(targetSchool.pricing_model, 'PER_STUDENT');
  assert.strictEqual(targetSchool.price_per_student, 35.0);
  assert.strictEqual(targetSchool.approval_status, 'APPROVED');

  // 4. Test Financial Ledger
  const ledger = biAnalyticsService.getFinancialLedger();
  assert.ok(Array.isArray(ledger), 'Financial ledger must return array of records');
  const invRecord = ledger.find(i => i.invoice_id === invoiceId);
  assert.ok(invRecord, 'Test invoice must appear in financial ledger');
  assert.strictEqual(invRecord.invoice_status, 'PAID');
  assert.strictEqual(invRecord.total_amount, 118000.0);
  assert.strictEqual(invRecord.latest_payment_method, 'BANK_TRANSFER');

  // 5. Test Academic Census Report
  const census = biAnalyticsService.getAcademicCensusReport();
  assert.ok(Array.isArray(census), 'Academic census must return array of records');
  const censusRecord = census.find(c => c.school_id === schoolId);
  assert.ok(censusRecord, 'Test school must appear in census report');
  assert.strictEqual(censusRecord.total_students, 1200);
  assert.strictEqual(censusRecord.active_students, 1180);
  assert.strictEqual(censusRecord.total_teachers, 75);

  // 6. Test Security Audit Report
  const security = biAnalyticsService.getSecurityAuditReport();
  assert.ok(Array.isArray(security), 'Security audit report must return array of events');

  // 7. Test Deep Analytics Aggregator
  const deep = biAnalyticsService.getDeepAnalytics();
  assert.ok(deep.kpis.totalSchools >= 1, 'Deep analytics must reflect total active schools');
  assert.ok(deep.kpis.totalStudents >= 1200, 'Census count must be >= 1200');
  assert.ok(typeof deep.kpis === 'object', 'KPIs object must be present');
  assert.ok(deep.kpis.totalInvoiced >= 118000.0, 'Total invoiced must include test invoice');

  // Clean up test data
  db.run('DELETE FROM payments WHERE id = ?', paymentId);
  db.run('DELETE FROM invoices WHERE id = ?', invoiceId);
  db.run('DELETE FROM school_sync_metrics WHERE id = ?', metricId);

  console.log('✓ Deep analytics, financial ledgers, academic census & audit verification PASSED');
} finally {
  deleteTestSchool(schoolId);
}
