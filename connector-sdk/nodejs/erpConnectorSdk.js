const crypto = require('crypto');

/**
 * Enterprise School ERP Connector SDK (Node.js)
 * Enables any independent school ERP to securely integrate with Central ERP Command.
 */
class ERPConnectorSDK {
  constructor({ centralUrl, schoolId, apiKey, hmacSecret, timeoutMs = 10000 }) {
    if (!centralUrl || !schoolId || !apiKey || !hmacSecret) {
      throw new Error('ERPConnectorSDK requires centralUrl, schoolId, apiKey, and hmacSecret');
    }
    this.centralUrl = centralUrl.replace(/\/+$/, '');
    this.schoolId = schoolId;
    this.apiKey = apiKey;
    this.hmacSecret = hmacSecret;
    this.timeoutMs = timeoutMs;
  }

  /**
   * Generates HMAC-SHA256 signature for request payload
   */
  generateSignature(timestamp, bodyString = '') {
    const signingPayload = `${this.schoolId}:${timestamp}:${bodyString}`;
    return crypto.createHmac('sha256', this.hmacSecret).update(signingPayload).digest('hex');
  }

  /**
   * Internal authenticated request dispatcher
   */
  async request(endpoint, { method = 'GET', body = null, idempotencyKey = null } = {}) {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const bodyString = body ? JSON.stringify(body) : '';
    const signature = this.generateSignature(timestamp, bodyString);

    const headers = {
      'Content-Type': 'application/json',
      'x-school-id': this.schoolId,
      'x-api-key': this.apiKey,
      'x-timestamp': timestamp,
      'x-signature': signature
    };

    if (idempotencyKey) {
      headers['x-idempotency-key'] = idempotencyKey;
    }

    const url = `${this.centralUrl}/api/v1/connector${endpoint}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const res = await fetch(url, {
        method,
        headers,
        body: bodyString || undefined,
        signal: controller.signal
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `HTTP ${res.status}: Integration API request failed`);
      }
      return data;
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Check school operational status & subscription validity
   */
  async checkLicenseStatus() {
    return this.request('/status', { method: 'GET' });
  }

  /**
   * Send performance telemetry & heartbeat
   */
  async sendHeartbeat(telemetry = {}) {
    return this.request('/heartbeat', {
      method: 'POST',
      body: {
        cpu_usage_pct: telemetry.cpu_usage_pct || 15.0,
        memory_usage_pct: telemetry.memory_usage_pct || 42.0,
        disk_usage_pct: telemetry.disk_usage_pct || 28.0,
        database_size_mb: telemetry.database_size_mb || 5120.0,
        response_time_ms: telemetry.response_time_ms || 35,
        active_sessions: telemetry.active_sessions || 80
      }
    });
  }

  /**
   * Synchronize aggregated census, operational statistics, and local security events
   */
  async syncData(syncPayload, idempotencyKey = null) {
    return this.request('/sync', {
      method: 'POST',
      body: syncPayload,
      idempotencyKey
    });
  }

  /**
   * Poll pull-based pending command queue
   */
  async pollPendingCommands() {
    const res = await this.request('/commands/pending', { method: 'GET' });
    return res.data || [];
  }

  /**
   * Acknowledge command execution
   */
  async acknowledgeCommand(commandId, executionStatus = 'SUCCESS', resultLog = '') {
    return this.request(`/commands/${commandId}/ack`, {
      method: 'POST',
      body: {
        execution_status: executionStatus,
        result_log: resultLog
      }
    });
  }
}

module.exports = ERPConnectorSDK;
