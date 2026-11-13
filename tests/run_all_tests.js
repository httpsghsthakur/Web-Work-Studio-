const path = require('path');

console.log('================================================================');
console.log('  CENTRAL ERP COMMAND — COMPREHENSIVE AUTOMATED VERIFICATION');
console.log('================================================================');

const testSuites = [
  './test_auth_rbac.js',
  './test_hmac_security.js',
  './test_tenant_isolation.js',
  './test_remote_control.js',
  './test_financial_invoicing.js',
  './test_sync_and_bi.js',
  './test_per_student_pricing.js'
];

let passedCount = 0;
let failedCount = 0;

for (const suite of testSuites) {
  try {
    require(suite);
    passedCount++;
  } catch (err) {
    console.error(`\n❌ FAILED in ${suite}:`, err.message);
    if (err.stack) console.error(err.stack);
    failedCount++;
  }
}

console.log('\n================================================================');
console.log(`  VERIFICATION RESULTS: ${passedCount} PASSED, ${failedCount} FAILED`);
console.log('================================================================');

if (failedCount > 0) {
  process.exit(1);
} else {
  console.log('🎉 ALL INTEGRATION, SECURITY, COMMAND QUEUE & FINANCIAL TESTS VERIFIED!');
  process.exit(0);
}
