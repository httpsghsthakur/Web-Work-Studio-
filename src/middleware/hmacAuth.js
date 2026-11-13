const crypto = require('crypto');
const config = require('../config/config');
const db = require('../database/db');

function verifyHmacSignature(req, res, next) {
  const schoolId = req.headers['x-school-id'];
  const apiKey = req.headers['x-api-key'];
  const timestampStr = req.headers['x-timestamp'];
  const clientSignature = req.headers['x-signature'];

  if (!schoolId || !apiKey || !timestampStr || !clientSignature) {
    return res.status(401).json({
      success: false,
      error: 'Missing required integration authentication headers: x-school-id, x-api-key, x-timestamp, x-signature'
    });
  }

  // 1. Verify timestamp drift to prevent replay attacks
  const reqTime = parseInt(timestampStr, 10);
  const now = Math.floor(Date.now() / 1000);
  if (isNaN(reqTime) || Math.abs(now - reqTime) > config.REPLAY_WINDOW_SECONDS) {
    // Log replay attack attempt
    db.run(
      `INSERT INTO security_events (id, school_id, event_type, severity, user_identifier, ip_address, description, source_erp, metadata_json)
       VALUES (?, ?, 'REPLAY_ATTACK_DETECTED', 'WARNING', ?, ?, 'Integration request timestamp outside permitted 300s window', 'Connector Gateway', ?)`,
      `sec-err-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      schoolId,
      schoolId,
      req.ip || 'unknown',
      JSON.stringify({ reqTime, serverTime: now, driftSeconds: Math.abs(now - reqTime) })
    );

    return res.status(401).json({
      success: false,
      error: `Timestamp drift exceeded ${config.REPLAY_WINDOW_SECONDS} seconds. Replay protection triggered.`
    });
  }

  // 2. Fetch school credentials from database
  const school = db.get(
    'SELECT id, code, name, status, api_key, hmac_secret, ip_whitelist, active_modules_json FROM schools WHERE id = ?',
    schoolId
  );

  if (!school) {
    return res.status(401).json({ success: false, error: 'Unrecognized school integration identity' });
  }

  // 3. Verify API Key
  if (school.api_key !== apiKey) {
    db.run(
      `INSERT INTO security_events (id, school_id, event_type, severity, user_identifier, ip_address, description, source_erp, metadata_json)
       VALUES (?, ?, 'INTEGRATION_AUTH_FAILED', 'ERROR', ?, ?, 'Invalid API Key provided for school identity', 'Connector Gateway', ?)`,
      `sec-err-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      schoolId,
      schoolId,
      req.ip || 'unknown',
      JSON.stringify({ providedKey: apiKey.substring(0, 8) + '...' })
    );

    return res.status(401).json({ success: false, error: 'Invalid API key for school' });
  }

  // 4. Verify HMAC-SHA256 signature
  // Payload for signature: schoolId + ':' + timestamp + ':' + rawBodyString
  const bodyString = req.rawBody || (req.body ? JSON.stringify(req.body) : '');
  const signingPayload = `${schoolId}:${timestampStr}:${bodyString}`;

  const hmac = crypto.createHmac('sha256', school.hmac_secret);
  hmac.update(signingPayload);
  const expectedSignature = hmac.digest('hex');

  const clientSigBuf = Buffer.from(clientSignature, 'utf8');
  const expectedSigBuf = Buffer.from(expectedSignature, 'utf8');

  let isValid = false;
  if (clientSigBuf.length === expectedSigBuf.length) {
    isValid = crypto.timingSafeEqual(clientSigBuf, expectedSigBuf);
  }

  if (!isValid) {
    db.run(
      `INSERT INTO security_events (id, school_id, event_type, severity, user_identifier, ip_address, description, source_erp, metadata_json)
       VALUES (?, ?, 'HMAC_SIGNATURE_MISMATCH', 'CRITICAL', ?, ?, 'HMAC-SHA256 signature verification failed. Potential tampering or incorrect secret.', 'Connector Gateway', ?)`,
      `sec-err-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      schoolId,
      schoolId,
      req.ip || 'unknown',
      JSON.stringify({ providedSig: clientSignature.substring(0, 10) + '...' })
    );

    return res.status(401).json({ success: false, error: 'HMAC signature verification failed. Request untrusted.' });
  }

  // 5. Update health and heartbeat
  db.run(
    "UPDATE schools SET last_heartbeat_at = datetime('now'), health_status = 'HEALTHY' WHERE id = ?",
    schoolId
  );

  req.school = school;
  next();
}

module.exports = {
  verifyHmacSignature
};
