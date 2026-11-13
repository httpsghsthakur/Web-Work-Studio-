const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const db = require('../database/db');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { logAudit } = require('../middleware/auditLogger');

// GET /api/v1/invoices - List invoices with filters
router.get('/', authenticateToken, (req, res) => {
  try {
    const { school_id, status } = req.query;

    let sql = `
      SELECT 
        i.*,
        s.name as school_name,
        s.code as school_code,
        s.owner_email,
        p.name as plan_name
      FROM invoices i
      JOIN schools s ON i.school_id = s.id
      LEFT JOIN subscription_plans p ON i.plan_id = p.id
      WHERE 1=1
    `;
    const params = [];

    if (school_id) {
      sql += ' AND i.school_id = ?';
      params.push(school_id);
    }
    if (status) {
      sql += ' AND i.status = ?';
      params.push(status);
    }

    sql += ' ORDER BY i.issue_date DESC';

    const invoices = db.all(sql, ...params);
    res.json({ success: true, count: invoices.length, data: invoices });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/v1/invoices/:id - Detailed invoice with payments
router.get('/:id', authenticateToken, (req, res) => {
  try {
    const invoice = db.get(`
      SELECT 
        i.*,
        s.name as school_name,
        s.code as school_code,
        s.address as school_address,
        s.city as school_city,
        s.state as school_state,
        s.owner_name,
        s.owner_email,
        s.owner_phone,
        p.name as plan_name
      FROM invoices i
      JOIN schools s ON i.school_id = s.id
      LEFT JOIN subscription_plans p ON i.plan_id = p.id
      WHERE i.id = ?
    `, req.params.id);

    if (!invoice) {
      return res.status(404).json({ success: false, error: 'Invoice not found' });
    }

    const payments = db.all('SELECT * FROM payments WHERE invoice_id = ? ORDER BY payment_date DESC', invoice.id);

    res.json({
      success: true,
      data: {
        invoice,
        payments
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/v1/invoices - Generate new invoice
router.post('/', authenticateToken, requireRole(['SUPER_ADMIN', 'FINANCE_OFFICER']), (req, res) => {
  try {
    const { school_id, plan_id, billing_cycle, period_start, period_end, subtotal, tax_rate = 18.0, due_date, notes } = req.body;

    if (!school_id || !subtotal || !due_date || !period_start || !period_end) {
      return res.status(400).json({
        success: false,
        error: 'school_id, subtotal, due_date, period_start, and period_end are required'
      });
    }

    const school = db.get('SELECT id, name, plan_id, billing_cycle FROM schools WHERE id = ?', school_id);
    if (!school) {
      return res.status(404).json({ success: false, error: 'School not found' });
    }

    const invoiceNum = `INV-${new Date().getFullYear()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    const invoiceId = `inv-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const numSubtotal = parseFloat(subtotal);
    const numTaxRate = parseFloat(tax_rate);
    const taxAmount = (numSubtotal * numTaxRate) / 100;
    const totalAmount = numSubtotal + taxAmount;
    const balanceDue = totalAmount;

    db.run(`
      INSERT INTO invoices (
        id, invoice_number, school_id, plan_id, billing_cycle, period_start, period_end,
        issue_date, due_date, subtotal, tax_rate, tax_amount, total_amount, balance_due, status, notes
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?,
        date('now'), ?, ?, ?, ?, ?, ?, 'PENDING', ?
      )
    `,
      invoiceId, invoiceNum, school.id, plan_id || school.plan_id, billing_cycle || school.billing_cycle,
      period_start, period_end, due_date, numSubtotal, numTaxRate, taxAmount, totalAmount, balanceDue, notes || ''
    );

    // Update school payment_status to PENDING if currently PAID
    db.run("UPDATE schools SET payment_status = 'PENDING' WHERE id = ? AND payment_status = 'PAID'", school.id);

    logAudit({
      userId: req.user.id,
      userEmail: req.user.email,
      action: 'GENERATE_INVOICE',
      targetType: 'INVOICE',
      targetId: invoiceId,
      details: { invoiceNum, totalAmount, schoolId: school.id },
      ip: req.ip
    });

    res.status(201).json({
      success: true,
      message: 'Invoice generated successfully',
      data: { invoiceId, invoiceNum, totalAmount }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/v1/invoices/:id/payments - Record manual payment
router.post('/:id/payments', authenticateToken, requireRole(['SUPER_ADMIN', 'FINANCE_OFFICER']), (req, res) => {
  try {
    const { amount, payment_method = 'BANK_TRANSFER', transaction_reference, notes, payment_date = new Date().toISOString().slice(0, 10) } = req.body;

    if (!amount || parseFloat(amount) <= 0) {
      return res.status(400).json({ success: false, error: 'Valid payment amount is required' });
    }

    const invoice = db.get('SELECT * FROM invoices WHERE id = ?', req.params.id);
    if (!invoice) {
      return res.status(404).json({ success: false, error: 'Invoice not found' });
    }

    const payAmount = parseFloat(amount);
    const newBalance = Math.max(0, invoice.balance_due - payAmount);
    const newStatus = newBalance === 0 ? 'PAID' : (newBalance < invoice.total_amount ? 'PARTIALLY_PAID' : invoice.status);

    const paymentNum = `PAY-${new Date().getFullYear()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    const paymentId = `pay-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    db.transaction((tx) => {
      // 1. Record payment
      tx.run(`
        INSERT INTO payments (
          id, payment_number, invoice_id, school_id, amount, payment_date,
          payment_method, transaction_reference, status, recorded_by, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'SUCCESSFUL', ?, ?)
      `,
        paymentId, paymentNum, invoice.id, invoice.school_id, payAmount, payment_date,
        payment_method, transaction_reference || `REF-${Date.now()}`, req.user.id, notes || ''
      );

      // 2. Update invoice balance and status
      tx.run(
        'UPDATE invoices SET balance_due = ?, status = ?, updated_at = datetime("now") WHERE id = ?',
        newBalance, newStatus, invoice.id
      );

      // 3. Check if all invoices for school are now settled
      const remainingDues = tx.get(
        'SELECT SUM(balance_due) as remaining FROM invoices WHERE school_id = ? AND status IN ("OVERDUE", "PENDING", "PARTIALLY_PAID")',
        invoice.school_id
      );

      if (!remainingDues || remainingDues.remaining <= 0) {
        tx.run("UPDATE schools SET payment_status = 'PAID' WHERE id = ?", invoice.school_id);
      }
    });

    logAudit({
      userId: req.user.id,
      userEmail: req.user.email,
      action: 'RECORD_PAYMENT',
      targetType: 'PAYMENT',
      targetId: paymentId,
      details: { invoiceId: invoice.id, amount: payAmount, paymentNum },
      ip: req.ip
    });

    res.json({
      success: true,
      message: 'Payment recorded successfully',
      data: {
        paymentId,
        paymentNum,
        paidAmount: payAmount,
        remainingBalance: newBalance,
        invoiceStatus: newStatus
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/v1/invoices/:id/remind - Send payment reminder
router.post('/:id/remind', authenticateToken, requireRole(['SUPER_ADMIN', 'FINANCE_OFFICER']), (req, res) => {
  try {
    const invoice = db.get(`
      SELECT i.*, s.name as school_name, s.owner_email 
      FROM invoices i 
      JOIN schools s ON i.school_id = s.id 
      WHERE i.id = ?
    `, req.params.id);

    if (!invoice) {
      return res.status(404).json({ success: false, error: 'Invoice not found' });
    }

    db.run("UPDATE invoices SET reminder_sent_at = datetime('now') WHERE id = ?", invoice.id);

    // Create system notification
    db.run(`
      INSERT INTO system_notifications (id, type, title, message, severity, school_id, action_url)
      VALUES (?, 'PAYMENT_REMINDER_SENT', 'Payment Reminder Dispatched', ?, 'INFO', ?, '/invoices')
    `,
      `notif-rem-${Date.now()}`,
      `Payment reminder for ${invoice.invoice_number} (₹${invoice.balance_due.toLocaleString()}) dispatched to ${invoice.owner_email}.`,
      invoice.school_id
    );

    res.json({
      success: true,
      message: `Reminder successfully sent to ${invoice.owner_email} for ${invoice.invoice_number}`
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/v1/invoices/all-payments - List all payment transactions
router.get('/data/payments', authenticateToken, (req, res) => {
  try {
    const payments = db.all(`
      SELECT p.*, i.invoice_number, s.name as school_name, s.code as school_code
      FROM payments p
      JOIN schools s ON p.school_id = s.id
      LEFT JOIN invoices i ON p.invoice_id = i.id
      ORDER BY p.payment_date DESC
    `);
    res.json({ success: true, count: payments.length, data: payments });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
