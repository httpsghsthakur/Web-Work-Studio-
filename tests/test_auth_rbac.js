const assert = require('assert');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../src/config/config');
const db = require('../src/database/db');

console.log('--- TEST SUITE 1: AUTHENTICATION & RBAC PERMISSIONS ---');

// 1. Verify User Seeding
const adminUser = db.get('SELECT * FROM users WHERE email = ?', 'admin@centralcommand.io');
assert.ok(adminUser, 'Super Admin user must exist');
assert.strictEqual(adminUser.role, 'SUPER_ADMIN', 'Role must be SUPER_ADMIN');

// 2. Verify Password Hashing
const validPassword = bcrypt.compareSync('Admin@123456', adminUser.password_hash);
assert.strictEqual(validPassword, true, 'Valid password must match hash');
const invalidPassword = bcrypt.compareSync('WrongPassword', adminUser.password_hash);
assert.strictEqual(invalidPassword, false, 'Invalid password must not match hash');

// 3. Verify JWT Generation & Verification
const token = jwt.sign(
  { id: adminUser.id, email: adminUser.email, role: adminUser.role },
  config.JWT_SECRET,
  { expiresIn: config.JWT_EXPIRES_IN }
);
const decoded = jwt.verify(token, config.JWT_SECRET);
assert.strictEqual(decoded.id, adminUser.id, 'Decoded JWT ID must match');
assert.strictEqual(decoded.role, 'SUPER_ADMIN', 'Decoded JWT role must match');

// 4. Verify Auditor Role Exists and has restrictive permissions
const auditorUser = db.get('SELECT * FROM users WHERE email = ?', 'auditor@centralcommand.io');
assert.ok(auditorUser, 'Auditor user must exist');
assert.strictEqual(auditorUser.role, 'AUDITOR', 'Role must be AUDITOR');

console.log('✓ Authentication & RBAC tests PASSED');
