# Central ERP Command — Security Architecture

## 1. Multi-Tenant Cryptographic Isolation
Each school ERP is provisioned with a distinct pair of cryptographic credentials:
- `api_key`: A 24-character hexadecimal public identifier.
- `hmac_secret`: A 48-character high-entropy secret stored exclusively on the central database and the local school connector config.

### Threat Model & Countermeasures

| Threat Vector | Attack Scenario | Countermeasure Enforced |
|---|---|---|
| **Man-in-the-Middle (MitM)** | Attacker intercepts or modifies student counts or financial figures in transit. | HTTPS-only transport combined with HMAC-SHA256 signature calculated over the entire request body. Tampered payloads fail verification. |
| **Replay Attacks** | Attacker captures a valid sync request and resends it repeatedly to corrupt census numbers. | Strict timestamp validation: requests with `x-timestamp` deviating by > 300 seconds are rejected automatically. |
| **Cross-Tenant Impersonation** | School A attempts to poll or modify commands intended for School B. | School ID is cryptographically verified against the API key and HMAC signature. Command queries filter strictly by authenticated `school_id`. |
| **Remote Code Execution (RCE)** | Central administrator tries to send SQL injection or shell script to school. | Predefined Command Protocol: Only recognized command types (`SUSPEND_SERVICE`, `REACTIVATE_SERVICE`, `EXTEND_SUBSCRIPTION`, `UPDATE_MODULES`) are executed. No arbitrary SQL or shell commands exist. |
| **Accidental Data Loss** | Central admin suspends delinquent school, causing loss of student data. | Non-Destructive Suspension Guarantee: Suspension modifies only operational routing flags. Databases, historical attendance, and student profiles are never altered or dropped. |
| **Timing Side-Channel Attacks** | Attacker observes microsecond differences in signature string comparison. | Constant-time comparison using `crypto.timingSafeEqual` prevents timing leaks. |

---

## 2. Role-Based Access Control (RBAC)

The Central Command platform defines 4 administrative roles:

1. **SUPER_ADMIN (Chief SaaS Executive)**
   - Complete operational, financial, and administrative authority.
   - Can register schools, rotate credentials, enqueue suspension commands, and adjust global policies.
2. **OPERATIONS_MANAGER (Operations Lead)**
   - School onboarding, module entitlement adjustments, telemetry monitoring, and technical diagnostics.
   - Cannot view or edit banking or corporate accounting settings.
3. **FINANCE_OFFICER (Senior Billing Comptroller)**
   - Full access to subscription invoicing, manual payment logging, revenue analytics, and billing reminders.
   - Cannot execute remote service suspensions or rotate technical credentials.
4. **AUDITOR (Compliance & Security Auditor)**
   - Read-only access across centralized security logs, administrative audit trails, and student census aggregations.
   - All state-modifying actions are blocked.

---

## 3. Database Sanitization & Storage
- Central platform uses parameterized prepared statements throughout (`node:sqlite`). Zero dynamic SQL string concatenation.
- Passwords are encrypted using salted `bcrypt` with work factor 10.
- Secrets and tokens are redacted from user-facing logs and exports.
