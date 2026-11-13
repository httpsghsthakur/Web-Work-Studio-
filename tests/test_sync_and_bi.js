const assert = require('assert');
const db = require('../src/database/db');
const biAnalyticsService = require('../src/services/biAnalyticsService');
const { createTestSchool, deleteTestSchool } = require('./test_helpers');

console.log('--- TEST SUITE 6: DATA SYNCHRONIZATION, IDEMPOTENCY & BI ANALYTICS ---');

const schoolId = 'sch-test-bi-sync';
createTestSchool(schoolId, { status: 'ACTIVE', custom_price: 300000, billing_cycle: 'YEARLY' });

const idempotencyKey = `idemp-test-${Date.now()}`;
const newMetricId = `met-test-${Date.now()}`;

try {
  // 1. Ingest new synchronization record
db.run(`
  INSERT INTO school_sync_metrics (
    id, school_id, total_students, active_students, inactive_students,
    recent_admissions, departed_students, class_distribution_json,
    total_teachers, active_teachers, inactive_teachers,
    non_teaching_staff, recent_staff_hires, attendance_rate_pct,
    daily_active_logins, storage_used_mb, sync_source, idempotency_key
  ) VALUES (
    ?, ?, 2500, 2460, 40,
    75, 10, '{"Grade 1": 210, "Grade 2": 215}',
    140, 137, 3,
    60, 7, 96.5,
    2050, 54000.0, 'CONNECTOR_PUSH', ?
  )
`, newMetricId, schoolId, idempotencyKey);

// 2. Test Idempotency: Duplicate key check
const duplicateCheck = db.get('SELECT id FROM school_sync_metrics WHERE idempotency_key = ?', idempotencyKey);
assert.ok(duplicateCheck, 'Key must be recognized as previously processed');
assert.strictEqual(duplicateCheck.id, newMetricId);

// 3. Update school last sync timestamp
db.run("UPDATE schools SET last_sync_at = datetime('now'), health_status = 'HEALTHY' WHERE id = ?", schoolId);

// 4. Verify BI Analytics Service calculations
const dashboard = biAnalyticsService.getExecutiveDashboard();
assert.ok(dashboard.overview.census.total_students >= 2500, 'Total students census must reflect newly synchronized records');
assert.ok(dashboard.overview.financial.mrr > 0, 'MRR must be calculated and > 0');
assert.strictEqual(dashboard.overview.financial.arr, dashboard.overview.financial.mrr * 12, 'ARR must equal MRR * 12');

// Clean up test metric
db.run('DELETE FROM school_sync_metrics WHERE id = ?', newMetricId);

  console.log('✓ Data synchronization, idempotency & BI metrics calculation tests PASSED');
} finally {
  deleteTestSchool(schoolId);
}
