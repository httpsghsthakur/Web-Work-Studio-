# Central ERP Command — REST API Specification (v1)

## Base URL
```
https://<your-central-domain>/api/v1
```

## Security & Authentication Schemes

### 1. Management Console Authentication (Admin Users)
All management console endpoints require a JSON Web Token (JWT) in the HTTP Authorization header:
```http
Authorization: Bearer <jwt-token>
```
Tokens are issued upon successful authentication at `/api/v1/auth/login`.

### 2. School ERP Connector Authentication (Integration Handshake)
All School ERP connector endpoints (`/api/v1/connector/*`) use HMAC-SHA256 digital signature authentication with replay protection.

#### Required Request Headers
| Header | Type | Description |
|---|---|---|
| `x-school-id` | string | Unique School Identifier issued during onboarding (e.g., `sch-xavier-01`) |
| `x-api-key` | string | School API Key (e.g., `key_live_90218f4a...`) |
| `x-timestamp` | string | Current UNIX timestamp in seconds (e.g., `1731500000`) |
| `x-signature` | string | Hex-encoded HMAC-SHA256 signature |
| `x-idempotency-key` | string (optional) | Unique request ID to prevent duplicate processing on network retries |

#### Signature Algorithm
```
signing_payload = x_school_id + ":" + x_timestamp + ":" + raw_request_body_string
x_signature = HMAC_SHA256(secret=school_hmac_secret, message=signing_payload)
```

#### Replay Protection Window
Requests whose `x-timestamp` deviates by more than **300 seconds** (5 minutes) from the central server clock are rejected with HTTP 401 Unauthorized.

---

## Connector Endpoints (`/api/v1/connector`)

### 1. Check Operational License & Status
```http
GET /api/v1/connector/status
```
Returns operational license status, active modules, and grace period information.

#### Response (200 OK)
```json
{
  "success": true,
  "data": {
    "schoolId": "sch-xavier-01",
    "code": "SCH-XAVIER",
    "name": "St. Xavier's International Academy",
    "operationalStatus": "ACTIVE",
    "isServiceAllowed": true,
    "suspensionReason": null,
    "suspendedAt": null,
    "activeModules": ["admissions", "attendance", "fees", "academics", "reports"],
    "subscriptionEnd": "2027-01-01",
    "gracePeriodDays": 10,
    "paymentStatus": "PAID",
    "serverTime": "2026-11-13T11:00:00.000Z"
  }
}
```

### 2. Dispatch Vitality Heartbeat & Telemetry
```http
POST /api/v1/connector/heartbeat
```
Reports connector vitality and system metrics.

#### Request Body
```json
{
  "cpu_usage_pct": 22.4,
  "memory_usage_pct": 54.1,
  "disk_usage_pct": 32.5,
  "database_size_mb": 38400.0,
  "response_time_ms": 45,
  "active_sessions": 1420
}
```

#### Response (200 OK)
```json
{
  "success": true,
  "message": "Heartbeat recorded successfully",
  "hasPendingCommands": false,
  "timestamp": "2026-11-13T11:00:00.000Z"
}
```

### 3. Synchronize Academic Census & Operational Telemetry
```http
POST /api/v1/connector/sync
```

#### Request Body
```json
{
  "idempotency_key": "sync-xav-2026-11-13-1600",
  "student_statistics": {
    "total_students": 1840,
    "active_students": 1812,
    "inactive_students": 28,
    "recent_admissions": 45,
    "departed_students": 12,
    "class_distribution": {
      "Grade 1": 150,
      "Grade 2": 155
    }
  },
  "teacher_statistics": {
    "total_teachers": 98,
    "active_teachers": 96,
    "inactive_teachers": 2,
    "non_teaching_staff": 42,
    "recent_staff_hires": 4
  },
  "operational_statistics": {
    "attendance_rate_pct": 94.6,
    "daily_active_logins": 1420,
    "storage_used_mb": 38400.0
  },
  "security_events": [
    {
      "event_type": "ADMIN_LOGIN",
      "severity": "INFO",
      "user_identifier": "sysadmin@stxaviers.edu",
      "ip_address": "192.168.1.100",
      "description": "Administrator login with TOTP MFA"
    }
  ]
}
```

### 4. Pull Pending Remote Commands
```http
GET /api/v1/connector/commands/pending
```

#### Response (200 OK)
```json
{
  "success": true,
  "count": 1,
  "data": [
    {
      "commandId": "CMD-20261113-A1B2C3",
      "commandType": "SUSPEND_SERVICE",
      "payload": {
        "reason": "Annual subscription renewal overdue for 45 days.",
        "display_page": "SERVICE_SUSPENDED_OVERDUE",
        "support_contact": "billing@centralcommand.io"
      },
      "issuedAt": "2026-11-13T10:30:00.000Z",
      "expiresAt": "2026-11-14T10:30:00.000Z"
    }
  ]
}
```

### 5. Acknowledge Command Outcome
```http
POST /api/v1/connector/commands/:commandId/ack
```

#### Request Body
```json
{
  "execution_status": "SUCCESS",
  "result_log": "Local routing suspended. Data 100% intact."
}
```

---

## Central Management Endpoints

| Method | Endpoint | Description | Permitted Roles |
|---|---|---|---|
| POST | `/api/v1/auth/login` | Authenticate SaaS dashboard user | Public |
| GET | `/api/v1/schools` | List schools with status, payment, and search filters | All authenticated |
| GET | `/api/v1/schools/:id` | Full school profile with metrics, invoices, security logs | All authenticated |
| POST | `/api/v1/schools` | Register new school & generate credentials | SUPER_ADMIN, OPERATIONS_MANAGER |
| POST | `/api/v1/schools/:id/rotate-credentials` | Rotate API Key & HMAC Secret | SUPER_ADMIN |
| GET | `/api/v1/analytics/overview` | Executive SaaS BI dashboard KPIs and charts | All authenticated |
| GET | `/api/v1/analytics/comparison` | Cross-school comparative benchmark matrix | All authenticated |
| GET | `/api/v1/analytics/export` | Download comparison matrix as CSV | All authenticated |
| GET | `/api/v1/invoices` | List subscription invoices | All authenticated |
| POST | `/api/v1/invoices` | Issue new subscription invoice | SUPER_ADMIN, FINANCE_OFFICER |
| POST | `/api/v1/invoices/:id/payments` | Record manual bank/UPI payment receipt | SUPER_ADMIN, FINANCE_OFFICER |
| POST | `/api/v1/invoices/:id/remind` | Dispatch payment reminder notification | SUPER_ADMIN, FINANCE_OFFICER |
| POST | `/api/v1/remote-control/issue` | Enqueue predefined service control command | SUPER_ADMIN, OPERATIONS_MANAGER |
| GET | `/api/v1/security/events` | Stream centralized security telemetry | All authenticated |
