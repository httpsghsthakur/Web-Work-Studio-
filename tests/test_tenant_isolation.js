const assert = require('assert');
const db = require('../src/database/db');
const commandQueueService = require('../src/services/commandQueueService');
const { createTestSchool, deleteTestSchool } = require('./test_helpers');

console.log('--- TEST SUITE 3: MULTI-SCHOOL STRICT TENANT ISOLATION ---');

const schoolA = createTestSchool('sch-tenant-a');
const schoolB = createTestSchool('sch-tenant-b');

try {
  // 1. Issue command explicitly for School A
const cmdResult = commandQueueService.enqueueCommand({
  schoolId: schoolA.id,
  commandType: 'UPDATE_MODULES',
  payload: { enabled_modules: ['admissions', 'attendance', 'fees'] },
  issuedBy: 'TENANT_ISOLATION_TEST'
});

assert.strictEqual(cmdResult.schoolId, schoolA.id);

// 2. Poll pending commands for School B -> Must NOT contain School A's command!
const schoolBCommands = commandQueueService.getPendingCommands(schoolB.id);
const leakedCmd = schoolBCommands.find(c => c.commandId === cmdResult.commandId);
assert.strictEqual(leakedCmd, undefined, 'CRITICAL: School B must NOT be able to poll School A commands!');

// 3. Poll pending commands for School A -> Must contain School A's command
const schoolACommands = commandQueueService.getPendingCommands(schoolA.id);
const foundCmd = schoolACommands.find(c => c.commandId === cmdResult.commandId);
assert.ok(foundCmd, 'School A must receive its own queued command');

// 4. Attempt to acknowledge School A's command using School B's identity -> Must be rejected!
let crossTenantAckFailed = false;
try {
  commandQueueService.acknowledgeCommand({
    schoolId: schoolB.id, // Maliciously spoofing School B identity for School A command
    commandId: cmdResult.commandId,
    executionStatus: 'SUCCESS'
  });
} catch (err) {
  crossTenantAckFailed = true;
}
assert.strictEqual(crossTenantAckFailed, true, 'Cross-tenant command acknowledgment must fail with error');

// 5. Verify isolated metrics records
const metricsA = db.all('SELECT * FROM school_sync_metrics WHERE school_id = ?', schoolA.id);
const metricsB = db.all('SELECT * FROM school_sync_metrics WHERE school_id = ?', schoolB.id);
metricsA.forEach(m => assert.strictEqual(m.school_id, schoolA.id));
metricsB.forEach(m => assert.strictEqual(m.school_id, schoolB.id));

  console.log('✓ Strict multi-tenant isolation tests PASSED');
} finally {
  deleteTestSchool('sch-tenant-a');
  deleteTestSchool('sch-tenant-b');
}
