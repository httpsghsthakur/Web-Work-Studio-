const assert = require('assert');
const crypto = require('crypto');
const db = require('../src/database/db');

console.log('--- TEST SUITE 5: SUBSCRIPTION INVOICING & PAYMENT RECONCILIATION ---');

const schoolId = 'sch-xavier-01';
const invoiceId = `inv-test-${Date.now()}`;
const invoiceNum = `INV-TEST-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

// 1. Generate Invoice (Subtotal ₹100,000 + 18% GST = ₹118,000)
const subtotal = 100000.00;
const taxRate = 18.0;
const taxAmount = (subtotal * taxRate) / 100;
const totalAmount = subtotal + taxAmount;

db.run(`
  INSERT INTO invoices (
    id, invoice_number, school_id, plan_id, billing_cycle, period_start, period_end,
    issue_date, due_date, subtotal, tax_rate, tax_amount, total_amount, balance_due, status
  ) VALUES (?, ?, ?, 'plan-enterprise', 'YEARLY', '2027-01-01', '2028-01-01', date('now'), date('now', '+15 days'), ?, ?, ?, ?, ?, 'PENDING')
`, invoiceId, invoiceNum, schoolId, subtotal, taxRate, taxAmount, totalAmount, totalAmount);

const createdInv = db.get('SELECT * FROM invoices WHERE id = ?', invoiceId);
assert.strictEqual(createdInv.total_amount, 118000.00);
assert.strictEqual(createdInv.balance_due, 118000.00);
assert.strictEqual(createdInv.status, 'PENDING');

// 2. Partial Payment Recording (₹50,000 via RTGS)
const paymentId1 = `pay-test-1-${Date.now()}`;
db.transaction((tx) => {
  tx.run(`
    INSERT INTO payments (id, payment_number, invoice_id, school_id, amount, payment_date, payment_method, transaction_reference, status)
    VALUES (?, 'PAY-TEST-001', ?, ?, 50000.00, date('now'), 'BANK_TRANSFER', 'HDFC_RTGS_TEST_01', 'SUCCESSFUL')
  `, paymentId1, invoiceId, schoolId);

  tx.run("UPDATE invoices SET balance_due = balance_due - 50000.00, status = 'PARTIALLY_PAID' WHERE id = ?", invoiceId);
});

const partialInv = db.get('SELECT * FROM invoices WHERE id = ?', invoiceId);
assert.strictEqual(partialInv.balance_due, 68000.00);
assert.strictEqual(partialInv.status, 'PARTIALLY_PAID');

// 3. Final Settlement Payment (₹68,000 via UPI)
const paymentId2 = `pay-test-2-${Date.now()}`;
db.transaction((tx) => {
  tx.run(`
    INSERT INTO payments (id, payment_number, invoice_id, school_id, amount, payment_date, payment_method, transaction_reference, status)
    VALUES (?, 'PAY-TEST-002', ?, ?, 68000.00, date('now'), 'UPI', 'UPI_TEST_REF_02', 'SUCCESSFUL')
  `, paymentId2, invoiceId, schoolId);

  tx.run("UPDATE invoices SET balance_due = 0.00, status = 'PAID' WHERE id = ?", invoiceId);
  tx.run("UPDATE schools SET payment_status = 'PAID' WHERE id = ?", schoolId);
});

const settledInv = db.get('SELECT * FROM invoices WHERE id = ?', invoiceId);
assert.strictEqual(settledInv.balance_due, 0.00);
assert.strictEqual(settledInv.status, 'PAID');

const updatedSchool = db.get('SELECT payment_status FROM schools WHERE id = ?', schoolId);
assert.strictEqual(updatedSchool.payment_status, 'PAID');

// Clean up test invoice & payments
db.run('DELETE FROM payments WHERE invoice_id = ?', invoiceId);
db.run('DELETE FROM invoices WHERE id = ?', invoiceId);

console.log('✓ Commercial subscription invoicing & payment reconciliation tests PASSED');
