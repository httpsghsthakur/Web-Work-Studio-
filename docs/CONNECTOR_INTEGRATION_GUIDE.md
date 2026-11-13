# Step-by-Step Guide: Connecting School ERPs to Central Command

This guide explains how to connect any independent school ERP website to **CENTRAL ERP COMMAND** without modifying or breaking any existing school ERP functionality.

---

## Architectural Principles

1. **Independent School Database Preservation**
   - Each school retains its own independent database, web server, and hosting environment.
   - The central platform never requires direct database connection strings, database credentials, or open inbound ports on the school server.
2. **Aggregated Telemetry (Zero Student PII at HQ)**
   - The connector pushes aggregated statistical counts (total enrolled, active students, teacher census, attendance rates).
   - Individual student identifying PII (names, personal phone numbers, Aadhaar/SSN) stays inside the school's local database.
3. **Pull-Based Predefined Remote Commands**
   - The school connector periodically checks for pending commands using an HTTPS pull request.
   - The connector executes only **predefined, audited commands** (`SUSPEND_SERVICE`, `REACTIVATE_SERVICE`, `EXTEND_SUBSCRIPTION`, `UPDATE_MODULES`).
   - Arbitrary shell or SQL commands are strictly prohibited by architecture.

---

## Step 1: Central Registration & Credential Generation

1. Log in to **Central ERP Command** (`https://<central-domain>`) as **Super Admin** or **Operations Lead**.
2. Navigate to **Schools** and click **Register School**.
3. Fill in:
   - School Name (e.g., `St. Xavier's International Academy`)
   - Unique School Code (e.g., `SCH-XAVIER`)
   - School ERP URL (e.g., `https://xavier.schools-erp.cloud`)
   - Principal & Technical Contact details
   - Assigned Subscription Plan & Billing Cycle
4. Click **Register & Generate Keys**.
5. Save the generated credentials securely:
   - **School ID:** `sch-xavier-01`
   - **API Key:** `key_live_...`
   - **HMAC Secret:** `sec_live_hmac_...` (Displayed only once!)

---

## Step 2: Install Connector SDK on School Server

Choose the appropriate SDK for your School ERP's technology stack:

### Option A: Node.js / Express / Next.js
Copy `connector-sdk/nodejs/erpConnectorSdk.js` and `adapters.js` into your school ERP project.

Install dependencies:
```bash
npm install node-cron
```

### Option B: Python / Django / Flask / FastAPI
Copy `connector-sdk/python/erp_connector_sdk.py` and `adapters.py` into your school ERP project.

Install dependencies:
```bash
pip install requests schedule
```

---

## Step 3: Implement Database Schema Adapter

School databases often use different table schemas. Choose or customize the adapter:

### 1. Standard Relational Schema (e.g. `students`, `teachers`, `attendance`)
```javascript
const { StandardSchoolERPAdapter } = require('./adapters');
const adapter = new StandardSchoolERPAdapter(localSchoolDatabase);
```

### 2. Legacy / Custom Schema (e.g. `tbl_pupil_master`, `tbl_faculty_payroll`)
```javascript
const { LegacyCustomERPAdapter } = require('./adapters');
const adapter = new LegacyCustomERPAdapter(localSchoolDatabase);
```

The adapter extracts aggregated statistics and formats them into the standard Central Command contract:
```json
{
  "student_statistics": {
    "total_students": 1840,
    "active_students": 1812,
    "inactive_students": 28,
    "recent_admissions": 45,
    "departed_students": 12,
    "class_distribution": { "Grade 1": 150, "Grade 2": 155 }
  },
  "teacher_statistics": {
    "total_teachers": 98,
    "active_teachers": 96,
    "inactive_teachers": 2,
    "non_teaching_staff": 42
  },
  "operational_statistics": {
    "attendance_rate_pct": 94.6,
    "daily_active_logins": 1420,
    "storage_used_mb": 38400.0
  }
}
```

---

## Step 4: Configure Background Daemon

Set up a background daemon or cron job on the school server that runs every 5 to 15 minutes:

```javascript
// run_connector_agent.js
const ERPConnectorSDK = require('./erpConnectorSdk');
const { StandardSchoolERPAdapter } = require('./adapters');

const sdk = new ERPConnectorSDK({
  centralUrl: process.env.CENTRAL_COMMAND_URL,
  schoolId: process.env.SCHOOL_ID,
  apiKey: process.env.SCHOOL_API_KEY,
  hmacSecret: process.env.SCHOOL_HMAC_SECRET
});

const adapter = new StandardSchoolERPAdapter();

async function runSyncCycle() {
  try {
    // 1. Send Vitality Heartbeat
    await sdk.sendHeartbeat();

    // 2. Synchronize Census Metrics
    const metrics = await adapter.extractMetrics();
    await sdk.syncData(metrics);

    // 3. Poll Pending Predefined Remote Commands
    const pendingCommands = await sdk.pollPendingCommands();
    for (const cmd of pendingCommands) {
      if (cmd.commandType === 'SUSPEND_SERVICE') {
        // Create local suspension flag file
        require('fs').writeFileSync('/tmp/erp_suspended.json', JSON.stringify(cmd.payload));
        await sdk.acknowledgeCommand(cmd.commandId, 'SUCCESS', 'Suspension flag created. Normal user logins locked.');
      } else if (cmd.commandType === 'REACTIVATE_SERVICE') {
        // Remove local suspension flag file
        if (require('fs').existsSync('/tmp/erp_suspended.json')) {
          require('fs').unlinkSync('/tmp/erp_suspended.json');
        }
        await sdk.acknowledgeCommand(cmd.commandId, 'SUCCESS', 'Suspension flag removed. Normal user access restored.');
      }
    }
  } catch (err) {
    console.error('[Connector Error]', err.message);
  }
}

// Run every 10 minutes
setInterval(runSyncCycle, 10 * 60 * 1000);
runSyncCycle();
```

---

## Step 5: Enforce Suspension Middleware in School Web Server

In the School ERP's main router or middleware, check if the suspension flag exists:

```javascript
// Express Middleware in School ERP
app.use((req, res, next) => {
  // Allow billing administrators or support bypass
  if (req.path.startsWith('/admin/billing-support') || req.path.startsWith('/api/v1/connector')) {
    return next();
  }

  // Check if school is suspended
  if (fs.existsSync('/tmp/erp_suspended.json')) {
    const info = JSON.parse(fs.readFileSync('/tmp/erp_suspended.json', 'utf8'));
    return res.status(403).render('service_suspended', {
      reason: info.reason || 'Annual subscription renewal overdue.',
      supportContact: info.support_contact || 'billing@centralcommand.io'
    });
  }

  next();
});
```

---

## Step 6: Verify Connection

1. On Central Command dashboard, check **Schools**.
2. St. Xavier's International Academy will display **HEALTHY** status with the last synchronization timestamp.
3. Test remote suspension: Click **Suspend ERP**.
4. Check school website: Users are routed to the clean suspended notice with billing contact.
5. Click **Reactivate ERP**: School portal immediately resumes full operational service.
