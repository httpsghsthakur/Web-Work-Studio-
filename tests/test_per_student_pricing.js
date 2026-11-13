const assert = require('assert');
const db = require('../src/database/db');
const automationEngine = require('../src/services/automationEngine');

console.log('--- TEST SUITE 7: DYNAMIC PER-STUDENT PRICING & 24H CENSUS RECONCILIATION ---');

// Clean up any stale test school with this key or code first
db.run("DELETE FROM schools WHERE api_key LIKE 'k_test_pricing%' OR code LIKE 'TEST-PRICE%'");

const testSchoolId = `sch-pricing-${Date.now()}`;
const uniqueKey = `k_test_pricing_${Date.now()}`;
const uniqueCode = `TEST-PRICE-${Date.now()}`;
const initialStudents = 620;
const pricePerStudent = 35.0; // ₹35 / student / month
const billingCycle = 'YEARLY'; // 12 months multiplier
const expectedInitialAmount = Math.round(initialStudents * pricePerStudent * 12); // 620 * 35 * 12 = 260400

try {
  // 1. Insert school with PER_STUDENT pricing model
  db.run(`
    INSERT INTO schools (
      id, name, code, erp_url, city, state, country,
      owner_name, owner_email, owner_phone,
      pricing_model, price_per_student, calculated_subscription_amount,
      plan_id, billing_cycle, subscription_start, subscription_end,
      payment_status, status, health_status,
      api_key, hmac_secret, last_student_check_at
    ) VALUES (
      ?, 'Pricing Test Academy', ?, 'https://test-price.example.com', 'Delhi', 'Delhi', 'India',
      'Tester', 'test@example.com', '9999999999',
      'PER_STUDENT', ?, ?,
      'plan-growth', ?, date('now'), date('now', '+1 year'),
      'PAID', 'ACTIVE', 'HEALTHY',
      ?, 's_test_pricing', datetime('now', '-25 hours')
    )
  `, testSchoolId, uniqueCode, pricePerStudent, expectedInitialAmount, billingCycle, uniqueKey);

// Initial student metrics
const initialMetricId = `met-init-${Date.now()}`;
db.run(`
  INSERT INTO school_sync_metrics (
    id, school_id, total_students, active_students, inactive_students,
    total_teachers, active_teachers, inactive_teachers, non_teaching_staff, sync_source
  ) VALUES (?, ?, ?, ?, ?, 30, 28, 2, 10, 'TEST_SEED')
`, initialMetricId, testSchoolId, initialStudents, initialStudents, 0);

// Verify insertion and calculated amount
const insertedSchool = db.get('SELECT * FROM schools WHERE id = ?', testSchoolId);
assert.strictEqual(insertedSchool.pricing_model, 'PER_STUDENT');
assert.strictEqual(insertedSchool.price_per_student, pricePerStudent);
assert.strictEqual(insertedSchool.calculated_subscription_amount, expectedInitialAmount);

// 2. Simulate new enrollment: 750 students in school ERP
const updatedMetricId = `met-updated-${Date.now()}`;
const newStudentCount = 750;
db.run(`
  INSERT INTO school_sync_metrics (
    id, school_id, total_students, active_students, inactive_students,
    total_teachers, active_teachers, inactive_teachers, non_teaching_staff, sync_source
  ) VALUES (?, ?, ?, ?, ?, 35, 33, 2, 12, 'ERP_CONNECTOR_SYNC')
`, updatedMetricId, testSchoolId, newStudentCount, newStudentCount, 0);

// 3. Trigger reconciliation method on demand (simulate "Check Students" button)
const result = automationEngine.reconcileSchoolStudentCensus(testSchoolId);
assert.ok(result, 'Reconciliation should succeed');
assert.strictEqual(result.studentCount, newStudentCount);
const expectedUpdatedAmount = Math.round(newStudentCount * pricePerStudent * 12); // 750 * 35 * 12 = 315000
assert.strictEqual(result.calculatedAmount, expectedUpdatedAmount);

// Verify updated row in DB
const refreshedSchool = db.get('SELECT * FROM schools WHERE id = ?', testSchoolId);
assert.strictEqual(refreshedSchool.calculated_subscription_amount, expectedUpdatedAmount);
assert.ok(refreshedSchool.last_student_check_at, 'Timestamp should be recorded');

// 4. Test 24-hour automation engine rule
// Reset last_student_check_at to 26 hours ago
db.run("UPDATE schools SET last_student_check_at = datetime('now', '-26 hours') WHERE id = ?", testSchoolId);

// Add another enrollment: 800 students
const autoMetricId = `met-auto-${Date.now()}`;
const autoStudentCount = 800;
db.run(`
  INSERT INTO school_sync_metrics (
    id, school_id, total_students, active_students, inactive_students,
    total_teachers, active_teachers, inactive_teachers, non_teaching_staff, sync_source
  ) VALUES (?, ?, ?, ?, ?, 38, 36, 2, 14, 'ERP_CONNECTOR_SYNC')
`, autoMetricId, testSchoolId, autoStudentCount, autoStudentCount, 0);

const ruleResults = automationEngine.evaluateRules();
const censusRule = ruleResults.find(r => r.ruleCode === 'RULE_24H_STUDENT_CENSUS_CHECK');
assert.ok(censusRule, 'RULE_24H_STUDENT_CENSUS_CHECK rule must be evaluated');
assert.ok(censusRule.actionsTaken >= 1, 'At least 1 school must be triggered for 24h census check');

const postAutoSchool = db.get('SELECT * FROM schools WHERE id = ?', testSchoolId);
const expectedAutoAmount = Math.round(autoStudentCount * pricePerStudent * 12); // 800 * 35 * 12 = 336000
assert.strictEqual(postAutoSchool.calculated_subscription_amount, expectedAutoAmount);

  console.log('✓ Dynamic per-student pricing & 24h census reconciliation tests PASSED');
} finally {
  // Always clean up test data
  db.run('DELETE FROM school_sync_metrics WHERE school_id = ?', testSchoolId);
  db.run('DELETE FROM schools WHERE id = ?', testSchoolId);
}
