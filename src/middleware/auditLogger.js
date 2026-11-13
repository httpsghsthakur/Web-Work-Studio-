const db = require('../database/db');

function logAudit({ userId, userEmail, action, targetType, targetId, details = {}, ip = '127.0.0.1' }) {
  try {
    const id = `aud-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    db.run(
      `INSERT INTO audit_logs (id, user_id, user_email, action, target_type, target_id, details_json, ip_address)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      id,
      userId || 'system',
      userEmail || 'system@centralcommand.io',
      action,
      targetType,
      targetId || null,
      JSON.stringify(details),
      ip
    );
  } catch (err) {
    console.error('[Audit Log Error]', err);
  }
}

module.exports = {
  logAudit
};
