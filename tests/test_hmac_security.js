const assert = require('assert');
const crypto = require('crypto');
const db = require('../src/database/db');
const { verifyHmacSignature } = require('../src/middleware/hmacAuth');

console.log('--- TEST SUITE 2: CONNECTOR HMAC SECURITY & REPLAY PROTECTION ---');

const school = db.get('SELECT * FROM schools WHERE id = ?', 'sch-xavier-01');
assert.ok(school, 'School sch-xavier-01 must exist');

// 1. Generate Valid Request
const timestamp = Math.floor(Date.now() / 1000).toString();
const body = { test_metric: 42 };
const bodyString = JSON.stringify(body);

const validPayload = `${school.id}:${timestamp}:${bodyString}`;
const validSignature = crypto.createHmac('sha256', school.hmac_secret).update(validPayload).digest('hex');

// Mock Express req, res, next
function createMockReq({ schoolId, apiKey, ts, sig, rawBody, bodyObj }) {
  return {
    headers: {
      'x-school-id': schoolId,
      'x-api-key': apiKey,
      'x-timestamp': ts,
      'x-signature': sig
    },
    rawBody: rawBody,
    body: bodyObj,
    ip: '127.0.0.1'
  };
}

function createMockRes() {
  return {
    statusCode: 200,
    bodyData: null,
    status: function (code) {
      this.statusCode = code;
      return this;
    },
    json: function (data) {
      this.bodyData = data;
      return this;
    }
  };
}

// Test A: Valid Request Passes
let nextCalled = false;
const reqA = createMockReq({
  schoolId: school.id,
  apiKey: school.api_key,
  ts: timestamp,
  sig: validSignature,
  rawBody: bodyString,
  bodyObj: body
});
const resA = createMockRes();
verifyHmacSignature(reqA, resA, () => { nextCalled = true; });
assert.strictEqual(nextCalled, true, 'Valid HMAC signature must call next()');
assert.strictEqual(reqA.school.id, school.id, 'School must be attached to request');

// Test B: Tampered Signature Fails
nextCalled = false;
const reqB = createMockReq({
  schoolId: school.id,
  apiKey: school.api_key,
  ts: timestamp,
  sig: 'invalid_tampered_signature_1234567890abcdef',
  rawBody: bodyString,
  bodyObj: body
});
const resB = createMockRes();
verifyHmacSignature(reqB, resB, () => { nextCalled = true; });
assert.strictEqual(nextCalled, false, 'Tampered HMAC must not call next()');
assert.strictEqual(resB.statusCode, 401, 'Tampered HMAC must return HTTP 401');

// Test C: Replay Attack (Stale Timestamp > 300s)
nextCalled = false;
const staleTimestamp = (Math.floor(Date.now() / 1000) - 3600).toString(); // 1 hour ago
const stalePayload = `${school.id}:${staleTimestamp}:${bodyString}`;
const staleSignature = crypto.createHmac('sha256', school.hmac_secret).update(stalePayload).digest('hex');

const reqC = createMockReq({
  schoolId: school.id,
  apiKey: school.api_key,
  ts: staleTimestamp,
  sig: staleSignature,
  rawBody: bodyString,
  bodyObj: body
});
const resC = createMockRes();
verifyHmacSignature(reqC, resC, () => { nextCalled = true; });
assert.strictEqual(nextCalled, false, 'Stale timestamp must not call next()');
assert.strictEqual(resC.statusCode, 401, 'Stale timestamp must return HTTP 401');
assert.ok(resC.bodyData.error.includes('Replay protection triggered'), 'Replay protection error must be reported');

// Test D: Invalid API Key Fails
nextCalled = false;
const reqD = createMockReq({
  schoolId: school.id,
  apiKey: 'wrong_key_998124',
  ts: timestamp,
  sig: validSignature,
  rawBody: bodyString,
  bodyObj: body
});
const resD = createMockRes();
verifyHmacSignature(reqD, resD, () => { nextCalled = true; });
assert.strictEqual(nextCalled, false, 'Invalid API key must not call next()');
assert.strictEqual(resD.statusCode, 401, 'Invalid API key must return HTTP 401');

// Verify that security events were logged into the database for failed attacks
const loggedTamper = db.get("SELECT * FROM security_events WHERE event_type = 'HMAC_SIGNATURE_MISMATCH' AND school_id = ?", school.id);
assert.ok(loggedTamper, 'Tamper event must be recorded in central security log');

const loggedReplay = db.get("SELECT * FROM security_events WHERE event_type = 'REPLAY_ATTACK_DETECTED' AND school_id = ?", school.id);
assert.ok(loggedReplay, 'Replay attack event must be recorded in central security log');

console.log('✓ HMAC verification, tamper prevention & replay protection tests PASSED');
