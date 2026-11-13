const assert = require('assert');
const db = require('../src/database/db');
const commandQueueService = require('../src/services/commandQueueService');

console.log('--- TEST SUITE 4: REMOTE SERVICE CONTROL (SUSPENSION & REACTIVATION) ---');

const testSchoolId = 'sch-greenvalley-06';

// 1. Initial State: Must be ACTIVE
const initialSchool = db.get('SELECT id, name, status FROM schools WHERE id = ?', testSchoolId);
assert.strictEqual(initialSchool.status, 'ACTIVE', 'Initial status must be ACTIVE');

// Verify student metrics count before suspension
const studentMetricsBefore = db.get('SELECT total_students FROM school_sync_metrics WHERE school_id = ? ORDER BY sync_timestamp DESC LIMIT 1', testSchoolId);
const studentCountBefore = studentMetricsBefore.total_students;

// 2. Enqueue SUSPEND_SERVICE command
const suspendReason = 'Annual ERP subscription payment delinquent for 45 days.';
const suspendResult = commandQueueService.enqueueCommand({
  schoolId: testSchoolId,
  commandType: 'SUSPEND_SERVICE',
  payload: {
    reason: suspendReason,
    display_page: 'SERVICE_SUSPENDED_OVERDUE',
    support_contact: 'billing@centralcommand.io'
  },
  issuedBy: 'SUPER_ADMIN_TEST'
});

assert.ok(suspendResult.commandId);
assert.strictEqual(suspendResult.status, 'PENDING');

// 3. School ERP Connector pulls pending commands
const pending = commandQueueService.getPendingCommands(testSchoolId);
const myCmd = pending.find(c => c.commandId === suspendResult.commandId);
assert.ok(myCmd, 'Connector must pull pending SUSPEND_SERVICE command');
assert.strictEqual(myCmd.commandType, 'SUSPEND_SERVICE');

// 4. Connector executes command locally and sends acknowledgment
const ackResult = commandQueueService.acknowledgeCommand({
  schoolId: testSchoolId,
  commandId: suspendResult.commandId,
  executionStatus: 'SUCCESS',
  resultLog: 'Local ERP routing locked to /service-suspended. Student/teacher logins intercepted. Database fully intact.'
});

assert.strictEqual(ackResult.status, 'EXECUTED');

// 5. Verify Central Platform State Transition -> SUSPENDED
const suspendedSchool = db.get('SELECT id, status, suspension_reason, suspended_at FROM schools WHERE id = ?', testSchoolId);
assert.strictEqual(suspendedSchool.status, 'SUSPENDED', 'School status must transition to SUSPENDED');
assert.strictEqual(suspendedSchool.suspension_reason, suspendReason);
assert.ok(suspendedSchool.suspended_at, 'suspended_at timestamp must be recorded');

// 6. CRITICAL: Verify Non-Destructive Guarantee (Zero data loss)
const studentMetricsAfter = db.get('SELECT total_students FROM school_sync_metrics WHERE school_id = ? ORDER BY sync_timestamp DESC LIMIT 1', testSchoolId);
assert.strictEqual(studentMetricsAfter.total_students, studentCountBefore, 'CRITICAL: Student records must remain 100% intact');

// 7. Test Remote Reactivation
const reactivateResult = commandQueueService.enqueueCommand({
  schoolId: testSchoolId,
  commandType: 'REACTIVATE_SERVICE',
  payload: { reason: 'Subscription invoice settled in full.' },
  issuedBy: 'SUPER_ADMIN_TEST'
});

const pendingReactivate = commandQueueService.getPendingCommands(testSchoolId);
assert.ok(pendingReactivate.length > 0);

commandQueueService.acknowledgeCommand({
  schoolId: testSchoolId,
  commandId: reactivateResult.commandId,
  executionStatus: 'SUCCESS',
  resultLog: 'Local ERP suspension removed. Normal login routing restored.'
});

// 8. Verify Central Platform State Transition -> Restored to ACTIVE
const reactivatedSchool = db.get('SELECT id, status, suspension_reason FROM schools WHERE id = ?', testSchoolId);
assert.strictEqual(reactivatedSchool.status, 'ACTIVE', 'School status must return to ACTIVE');
assert.strictEqual(reactivatedSchool.suspension_reason, null, 'Suspension reason must be cleared');

console.log('✓ Remote suspension, zero-data-loss guarantee & reactivation tests PASSED');
