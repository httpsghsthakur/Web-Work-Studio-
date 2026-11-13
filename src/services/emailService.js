const nodemailer = require('nodemailer');
const crypto = require('crypto');
const db = require('../database/db');
const pdfInvoiceService = require('./pdfInvoiceService');

class EmailService {
  constructor() {
    this.transporter = null;
    this.initTransporter();
  }

  /**
   * Initialize transporter (Live SMTP if env configured, else structured logger & ethereal test transport)
   */
  initTransporter() {
    if (process.env.SMTP_HOST && process.env.SMTP_USER) {
      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587', 10),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        }
      });
      console.log('✓ Email service configured with SMTP Host:', process.env.SMTP_HOST);
    } else {
      // Stream transport for resilient local development, test suites, and sandboxes
      this.transporter = nodemailer.createTransport({
        jsonTransport: true
      });
      console.log('✓ Email service configured in Local Direct Transport mode');
    }
  }

  /**
   * Send Invoice Bill / Reminder Email with PDF Attachment
   */
  async sendInvoiceEmail({ invoiceId, customMessage = '' }) {
    const { buffer, details } = await pdfInvoiceService.generateInvoicePdfBuffer(invoiceId);
    const { invoice } = details;

    const recipient = invoice.owner_email;
    if (!recipient) {
      throw new Error(`School ${invoice.school_name} does not have an owner email address specified`);
    }

    const subject = `[Invoice ${invoice.invoice_number}] Central ERP Command Subscription - Due: ${invoice.due_date}`;
    const amountDue = (invoice.balance_due || invoice.total_amount).toLocaleString('en-IN');
    const totalAmount = (invoice.total_amount || 0).toLocaleString('en-IN');

    const htmlBody = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; line-height: 1.5; margin: 0; padding: 20px; background-color: #f8fafc; }
          .container { max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; }
          .header { background: #1d4ed8; color: #ffffff; padding: 24px; text-align: left; }
          .header h1 { margin: 0; font-size: 20px; font-weight: 700; }
          .header p { margin: 4px 0 0; font-size: 13px; opacity: 0.9; }
          .content { padding: 24px; }
          .amount-box { background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 6px; padding: 16px; margin: 16px 0; text-align: center; }
          .amount-box .label { font-size: 13px; color: #1e40af; font-weight: 600; text-transform: uppercase; }
          .amount-box .value { font-size: 26px; color: #1d4ed8; font-weight: 800; margin-top: 4px; }
          .details-table { width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 14px; }
          .details-table td { padding: 8px 12px; border-bottom: 1px solid #f1f5f9; }
          .details-table td.label { color: #64748b; width: 40%; font-weight: 500; }
          .details-table td.val { font-weight: 600; }
          .bank-box { background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 6px; padding: 14px; font-size: 13px; margin: 16px 0; }
          .bank-box strong { color: #1e293b; }
          .footer { background: #f1f5f9; color: #64748b; padding: 16px 24px; font-size: 12px; text-align: center; }
          .badge { display: inline-block; padding: 4px 8px; font-size: 12px; font-weight: 700; border-radius: 4px; background: #fee2e2; color: #991b1b; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>CENTRAL ERP COMMAND</h1>
            <p>Official Multi-School SaaS Billing & Invoicing Notice</p>
          </div>
          <div class="content">
            <p>Dear <strong>${invoice.owner_name || 'School Administrator'}</strong>,</p>
            <p>Please find attached the official subscription invoice <strong>${invoice.invoice_number}</strong> for <strong>${invoice.school_name}</strong>.</p>
            
            <div class="amount-box">
              <div class="label">Balance Payment Due</div>
              <div class="value">₹${amountDue}</div>
              <div style="font-size: 12px; color: #64748b; margin-top: 4px;">Total Invoice: ₹${totalAmount} • Due Date: <strong>${invoice.due_date}</strong></div>
            </div>

            ${customMessage ? `<p style="padding: 10px 14px; background: #fef9c3; border-left: 4px solid #eab308; font-size: 13px;">${customMessage}</p>` : ''}

            <table class="details-table">
              <tr>
                <td class="label">School ID / Code:</td>
                <td class="val">${invoice.school_code || invoice.school_id}</td>
              </tr>
              <tr>
                <td class="label">Subscription Plan:</td>
                <td class="val">${invoice.plan_name || 'Campus Edition'}</td>
              </tr>
              <tr>
                <td class="label">Billing Cycle:</td>
                <td class="val">${invoice.billing_cycle}</td>
              </tr>
              <tr>
                <td class="label">Billing Service Period:</td>
                <td class="val">${invoice.period_start} to ${invoice.period_end}</td>
              </tr>
              <tr>
                <td class="label">Payment Status:</td>
                <td class="val"><span class="badge">${invoice.status}</span></td>
              </tr>
            </table>

            <div class="bank-box">
              <strong>Official Wire & UPI Settlement Instructions:</strong><br>
              • Bank: <strong>HDFC Bank Ltd</strong> (Current Account)<br>
              • Beneficiary: <strong>Central ERP Command Solutions Pvt Ltd</strong><br>
              • Account Number: <strong>50200088991122</strong><br>
              • IFSC Code: <strong>HDFC0001234</strong><br>
              • Instant UPI ID: <strong>centralerp@hdfcbank</strong><br>
              <em style="color: #64748b; font-size: 11px;">Please mention <strong>${invoice.invoice_number}</strong> in payment remarks.</em>
            </div>

            <p style="font-size: 13px; color: #64748b;">The complete official Tax Invoice PDF with detailed census breakdown and GST particulars is attached to this email.</p>
          </div>
          <div class="footer">
            Central ERP Command • Cyber Heights IT Park, Pune 411014<br>
            Billing Support: billing@centralcommand.io • +91 20 4000 8888
          </div>
        </div>
      </body>
      </html>
    `;

    const mailOptions = {
      from: process.env.SMTP_FROM || '"Central ERP Command Billing" <billing@centralcommand.io>',
      to: recipient,
      subject,
      html: htmlBody,
      attachments: [
        {
          filename: `Invoice-${invoice.invoice_number}.pdf`,
          content: buffer,
          contentType: 'application/pdf'
        }
      ]
    };

    const sendResult = await this.transporter.sendMail(mailOptions);
    const logId = `eml-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;

    // Record in database
    db.run(`
      INSERT INTO email_logs (
        id, recipient_email, recipient_name, school_id, invoice_id,
        email_type, subject, body_preview, has_attachment, status, sent_at
      ) VALUES (?, ?, ?, ?, ?, 'INVOICE_BILL', ?, ?, 1, 'SENT', datetime('now'))
    `,
      logId, recipient, invoice.owner_name || invoice.school_name,
      invoice.school_id, invoice.id, subject,
      `Invoice ${invoice.invoice_number} (₹${amountDue}) due on ${invoice.due_date}`
    );

    // Update invoice reminder_sent_at
    db.run("UPDATE invoices SET reminder_sent_at = datetime('now') WHERE id = ?", invoice.id);

    // Create system notification
    db.run(`
      INSERT INTO system_notifications (id, type, title, message, severity, school_id, action_url)
      VALUES (?, 'INVOICE_EMAIL_DISPATCHED', 'Invoice PDF Emailed to School Owner', ?, 'INFO', ?, '/invoices')
    `,
      `notif-eml-${Date.now()}`,
      `Invoice ${invoice.invoice_number} with PDF attachment successfully emailed to ${recipient} (${invoice.school_name}).`,
      invoice.school_id
    );

    return {
      success: true,
      logId,
      recipient,
      invoiceNumber: invoice.invoice_number,
      messageId: sendResult.messageId || logId
    };
  }

  /**
   * Send Payment Completed Confirmation & Receipt Email with PDF Attachment
   */
  async sendPaymentReceiptEmail({ invoiceId, paymentId }) {
    const { buffer, details } = await pdfInvoiceService.generateInvoicePdfBuffer(invoiceId);
    const { invoice, payments } = details;

    const payment = payments.find(p => p.id === paymentId) || payments[payments.length - 1];
    const recipient = invoice.owner_email;

    if (!recipient) {
      throw new Error(`School ${invoice.school_name} does not have an owner email address specified`);
    }

    const paidAmount = payment ? payment.amount.toLocaleString('en-IN') : invoice.total_amount.toLocaleString('en-IN');
    const paymentNum = payment ? payment.payment_number : 'PAY-SETTLED';
    const paymentDate = payment ? payment.payment_date : new Date().toISOString().slice(0, 10);
    const paymentMethod = payment ? payment.payment_method : 'BANK_TRANSFER';
    const txnRef = payment ? payment.transaction_reference : 'DIRECT_RECONCILIATION';

    const subject = `[Payment Confirmation] Receipt ${paymentNum} for Invoice ${invoice.invoice_number} - Central ERP Command`;

    const htmlBody = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; line-height: 1.5; margin: 0; padding: 20px; background-color: #f8fafc; }
          .container { max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; }
          .header { background: #16a34a; color: #ffffff; padding: 24px; text-align: left; }
          .header h1 { margin: 0; font-size: 20px; font-weight: 700; }
          .header p { margin: 4px 0 0; font-size: 13px; opacity: 0.9; }
          .content { padding: 24px; }
          .receipt-box { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; padding: 16px; margin: 16px 0; text-align: center; }
          .receipt-box .label { font-size: 13px; color: #166534; font-weight: 600; text-transform: uppercase; }
          .receipt-box .value { font-size: 28px; color: #16a34a; font-weight: 800; margin-top: 4px; }
          .details-table { width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 14px; }
          .details-table td { padding: 8px 12px; border-bottom: 1px solid #f1f5f9; }
          .details-table td.label { color: #64748b; width: 40%; font-weight: 500; }
          .details-table td.val { font-weight: 600; }
          .footer { background: #f1f5f9; color: #64748b; padding: 16px 24px; font-size: 12px; text-align: center; }
          .badge-paid { display: inline-block; padding: 4px 8px; font-size: 12px; font-weight: 700; border-radius: 4px; background: #dcfce7; color: #15803d; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>PAYMENT RECEIPT CONFIRMATION</h1>
            <p>Central ERP Command Subscription Management</p>
          </div>
          <div class="content">
            <p>Dear <strong>${invoice.owner_name || 'School Administrator'}</strong>,</p>
            <p>Thank you for your payment. We have successfully processed and verified your subscription payment for <strong>${invoice.school_name}</strong>.</p>
            
            <div class="receipt-box">
              <div class="label">Amount Paid & Settled</div>
              <div class="value">₹${paidAmount}</div>
              <div style="font-size: 12px; color: #166534; margin-top: 4px;">Status: <span class="badge-paid">PAID & VERIFIED</span> • Remaining Balance: <strong>₹${(invoice.balance_due || 0).toLocaleString('en-IN')}</strong></div>
            </div>

            <table class="details-table">
              <tr>
                <td class="label">Payment Receipt #:</td>
                <td class="val">${paymentNum}</td>
              </tr>
              <tr>
                <td class="label">Invoice Reference:</td>
                <td class="val"><strong>${invoice.invoice_number}</strong></td>
              </tr>
              <tr>
                <td class="label">School Name:</td>
                <td class="val">${invoice.school_name} (${invoice.school_code || invoice.school_id})</td>
              </tr>
              <tr>
                <td class="label">Payment Date:</td>
                <td class="val">${paymentDate}</td>
              </tr>
              <tr>
                <td class="label">Payment Method:</td>
                <td class="val">${paymentMethod}</td>
              </tr>
              <tr>
                <td class="label">Bank UTR / Transaction Ref:</td>
                <td class="val" style="font-family: monospace; color: #1d4ed8;">${txnRef}</td>
              </tr>
              <tr>
                <td class="label">Subscription Service Period:</td>
                <td class="val">${invoice.period_start} to ${invoice.period_end}</td>
              </tr>
            </table>

            <p style="font-size: 13px; color: #64748b;">The official stamped Tax Invoice and settlement receipt PDF has been attached to this email for your accounting and audit records.</p>
          </div>
          <div class="footer">
            Central ERP Command • Cyber Heights IT Park, Pune 411014<br>
            Billing Support: billing@centralcommand.io • +91 20 4000 8888
          </div>
        </div>
      </body>
      </html>
    `;

    const mailOptions = {
      from: process.env.SMTP_FROM || '"Central ERP Command Accounts" <billing@centralcommand.io>',
      to: recipient,
      subject,
      html: htmlBody,
      attachments: [
        {
          filename: `Receipt-${invoice.invoice_number}.pdf`,
          content: buffer,
          contentType: 'application/pdf'
        }
      ]
    };

    const sendResult = await this.transporter.sendMail(mailOptions);
    const logId = `eml-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;

    // Record in database
    db.run(`
      INSERT INTO email_logs (
        id, recipient_email, recipient_name, school_id, invoice_id, payment_id,
        email_type, subject, body_preview, has_attachment, status, sent_at
      ) VALUES (?, ?, ?, ?, ?, ?, 'PAYMENT_RECEIPT', ?, ?, 1, 'SENT', datetime('now'))
    `,
      logId, recipient, invoice.owner_name || invoice.school_name,
      invoice.school_id, invoice.id, paymentId, subject,
      `Payment receipt for ${paymentNum} of ₹${paidAmount} on ${invoice.invoice_number}`
    );

    // Create system notification
    db.run(`
      INSERT INTO system_notifications (id, type, title, message, severity, school_id, action_url)
      VALUES (?, 'PAYMENT_RECEIPT_EMAILED', 'Payment Receipt Emailed to School Owner', ?, 'INFO', ?, '/invoices')
    `,
      `notif-pay-eml-${Date.now()}`,
      `Payment receipt of ₹${paidAmount} for ${invoice.invoice_number} emailed to ${recipient} (${invoice.school_name}).`,
      invoice.school_id
    );

    return {
      success: true,
      logId,
      recipient,
      paymentNumber: paymentNum,
      messageId: sendResult.messageId || logId
    };
  }
}

module.exports = new EmailService();
