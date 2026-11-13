# CENTRAL ERP COMMAND — Multi-School ERP Management & Business Intelligence Platform

[![Node.js](https://img.shields.io/badge/Node.js-v24.x-green.svg)](https://nodejs.org/)
[![Database](https://img.shields.io/badge/Database-SQLite%20(node%3Asqlite)-blue.svg)](https://nodejs.org/api/sqlite.html)
[![Security](https://img.shields.io/badge/Security-HMAC--SHA256%20%2B%20Replay%20Protected-purple.svg)]()
[![Tests](https://img.shields.io/badge/Tests-100%25%20Passing-brightgreen.svg)]()

A centralized, multi-tenant SaaS business management platform and remote administration command center designed to monitor, bill, and remotely control dozens or hundreds of independent School ERP customer installations.

---

## 🌟 System Capabilities

1. **Executive SaaS Business Intelligence Dashboard**
   - Live KPI cards: Total registered schools, active subscriptions, suspended schools, trial schools.
   - Aggregate academic census: Enrolled students (8,840+), active students, teachers (387+), non-teaching staff (168+).
   - Commercial metrics: Accurate MRR (Monthly Recurring Revenue), ARR, Total collected revenue, and Overdue subscription dues.
   - 4 Interactive Chart.js visualizers: Student enrollment distribution, monthly revenue trend, faculty census, and subscription health.
   - Exact synchronization timestamps and stale telemetry alerts.

2. **Dedicated School Management Profiles**
   - Individual school profiles with logos, contact details, owner info, technical contact, plan tier, billing cycle, and live credentials preview.
   - Full student census breakdown: Enrolled, active, departed/transferred, recent admissions, and class-wise distribution (Grade 1 through 12).
   - Faculty & non-teaching staff distribution.
   - Complete commercial subscription history, generated invoices, and payment receipts.
   - Telemetry health: CPU load, memory usage, database storage consumed in GB, daily logins, attendance rates, and last ping.

3. **Centralized Commercial Subscription & Invoicing Management**
   - Separate SaaS subscription revenue from school's internal fee collections.
   - Subscription plans: Starter, Growth, Enterprise, Custom Mega-Campus.
   - Flexible billing cycles: Monthly, Quarterly, Half-Yearly, Yearly.
   - Invoicing engine: 18% GST tax calculation, due date tracking, balance due updates.
   - Payment ledger: Manual payment recording with bank wire/RTGS UTR references, UPI settlement IDs, corporate cards, and cash receipts.
   - Automatic reconciliation: Settling an invoice automatically updates school payment status to `PAID`.

4. **Remote ERP Service Control (Command Queue)**
   - Secure pull-based command queue: School ERP connectors poll for pending commands.
   - Predefined command operations:
     - `SUSPEND_SERVICE`: Intercepts normal student/teacher logins and routes to a clean suspended notice with billing contact.
     - `REACTIVATE_SERVICE`: Immediately restores normal operational school access.
     - `EXTEND_SUBSCRIPTION`: Adds grace days and recalculates expiry dates.
     - `UPDATE_MODULES`: Dynamically enables/disables ERP modules (admissions, attendance, fees, exams, library, transport, payroll).
     - `SET_GRACE_PERIOD`: Configures delinquent grace threshold.
   - **Zero Data Loss Guarantee:** Remote suspension never deletes or drops school databases, records, or accounts.
   - Full audit logging of every command with user, timestamp, target school, and outcome.

5. **Centralized Threat Telemetry & Security Logs**
   - Real-time security stream from all connected school ERPs: Failed login anomalies, admin privilege escalations, password resets, suspension orders.
   - Central platform administrative audit trail.

6. **Cross-School Analytics & Comparative Matrix**
   - Side-by-side benchmarking of schools.
   - One-click export to CSV (`/api/v1/analytics/export`).

7. **Configurable Automation Engine**
   - 7-day pre-expiry reminder policy.
   - Immediate invoice overdue alert.
   - Opt-in auto-suspension after grace period expiration.
   - 30-minute connector heartbeat loss detection.

8. **Enterprise UI/UX Design System**
   - Responsive desktop, tablet, and mobile layouts.
   - Dark mode and light mode toggle.
   - Interactive modals, confirmation dialogs for high-impact actions, toast notifications.

---

## 🏗️ Architecture

```
                               ┌────────────────────────────────────────────────────────┐
                               │           CENTRAL ERP COMMAND (SaaS HQ)                │
                               │                                                        │
                               │  - SaaS Executive BI Dashboard                         │
                               │  - Subscription & Invoicing Engine                     │
                               │  - Predefined Remote Command Queue                     │
                               │  - Central Security Stream & Audit Logs                │
                               │  - REST API (Node.js 24 + node:sqlite)                 │
                               └──────────────────────────┬─────────────────────────────┘
                                                          │
                                     HTTPS REST + HMAC-SHA256 Signed
                                     (x-school-id, x-api-key, timestamp, x-sig)
                                                          │
          ┌───────────────────────────────────────────────┼───────────────────────────────────────────────┐
          │                                               │                                               │
          ▼                                               ▼                                               ▼
┌───────────────────┐                           ┌───────────────────┐                           ┌───────────────────┐
│ St. Xavier ERP    │                           │  Oakridge ERP     │                           │ Delhi Heritage ERP│
│ - Independent DB  │                           │ - Independent DB  │                           │ - Independent DB  │
│ - Students: 1,840 │                           │ - Students: 960   │                           │ - Status: SUSP    │
│ - Connector SDK   │                           │ - Connector SDK   │                           │ - Data 100% Intact│
└───────────────────┘                           └───────────────────┘                           └───────────────────┘
```

---

## 🚀 Getting Started

### 1. Prerequisites
- Node.js 22.5+ or Node.js 24+

### 2. Setup & Database Seeding
```bash
# Seed database with realistic schools, users, invoices, and metrics
node --experimental-sqlite src/database/seed.js
```

### 3. Run Automated Verification Tests
```bash
node tests/run_all_tests.js
```

### 4. Start Server
```bash
node --experimental-sqlite src/server.js
```
Open **`http://localhost:4000`** in your browser.

---

## 👥 Demo Logins & Roles

| Role | Email | Password | Access Scope |
|---|---|---|---|
| **Super Admin** | `admin@centralcommand.io` | `Admin@123456` | Full Control (Suspension, Credentials, Financials) |
| **Operations** | `ops@centralcommand.io` | `Ops@123456` | School Onboarding, Modules, Telemetry |
| **Finance** | `finance@centralcommand.io` | `Finance@123456` | Invoices, Payment Ledger, Dues Tracking |
| **Auditor** | `auditor@centralcommand.io` | `Audit@123456` | Read-only Security Audit & Threat Stream |

---

## 📚 Documentation
- [API Specification](file:///c:/Users/gt643/Downloads/Web%20Work%20Management/docs/API_SPECIFICATION.md)
- [Connector Integration Guide](file:///c:/Users/gt643/Downloads/Web%20Work%20Management/docs/CONNECTOR_INTEGRATION_GUIDE.md)
- [Security Architecture](file:///c:/Users/gt643/Downloads/Web%20Work%20Management/docs/SECURITY_ARCHITECTURE.md)
- [Production Deployment Guide](file:///c:/Users/gt643/Downloads/Web%20Work%20Management/docs/DEPLOYMENT_GUIDE.md)
