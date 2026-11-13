const db = require('../src/database/db');

function createTestSchool(id = `sch-test-${Date.now()}-${Math.floor(Math.random() * 1000)}`, overrides = {}) {
  const school = {
    id,
    name: 'Test Academy',
    code: `TEST-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    erp_url: 'https://test.example.com',
    city: 'Test City',
    state: 'Test State',
    country: 'India',
    owner_name: 'Test Owner',
    owner_email: `test-${id}@example.com`,
    owner_phone: '+91 9999999999',
    plan_id: 'plan-enterprise',
    billing_cycle: 'YEARLY',
    custom_price: 100000,
    subscription_start: '2026-01-01',
    subscription_end: '2027-01-01',
    payment_status: 'PAID',
    status: 'ACTIVE',
    health_status: 'HEALTHY',
    api_key: `key_test_${id}_${Date.now()}`,
    hmac_secret: `sec_test_${id}_${Date.now()}`,
    remote_school_id: overrides.remote_school_id || `REMOTE-${id}`,
    data_access_approved: 1,
    ...overrides
  };

  db.run(`
    INSERT INTO schools (
      id, name, code, remote_school_id, data_access_approved, erp_url, city, state, country,
      owner_name, owner_email, owner_phone,
      plan_id, billing_cycle, custom_price, subscription_start, subscription_end,
      payment_status, status, health_status, api_key, hmac_secret
    ) VALUES (
      ?, ?, ?, ?, 1, ?, ?, ?, ?,
      ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?
    )
  `,
    school.id, school.name, school.code, school.remote_school_id, school.erp_url, school.city, school.state, school.country,
    school.owner_name, school.owner_email, school.owner_phone,
    school.plan_id, school.billing_cycle, school.custom_price, school.subscription_start, school.subscription_end,
    school.payment_status, school.status, school.health_status, school.api_key, school.hmac_secret
  );

  return school;
}

function deleteTestSchool(id) {
  try {
    db.run('DELETE FROM erp_telemetry_history WHERE school_id = ?', id);
    db.run('DELETE FROM security_events WHERE school_id = ?', id);
    db.run('DELETE FROM remote_commands WHERE school_id = ?', id);
    db.run('DELETE FROM payments WHERE school_id = ?', id);
    db.run('DELETE FROM invoices WHERE school_id = ?', id);
    db.run('DELETE FROM school_sync_metrics WHERE school_id = ?', id);
    db.run('DELETE FROM system_notifications WHERE school_id = ?', id);
    db.run('DELETE FROM schools WHERE id = ?', id);
  } catch (err) {
    // Ignore cleanup error
  }
}

module.exports = { createTestSchool, deleteTestSchool };
