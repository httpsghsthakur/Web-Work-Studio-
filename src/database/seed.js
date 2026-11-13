const bcrypt = require('bcryptjs');
const db = require('./db');

function seedDatabase() {
  console.log('[Seed] Starting database seeding...');

  // Check if already seeded
  const userCount = db.get('SELECT COUNT(*) as count FROM users');
  if (userCount && userCount.count > 0) {
    console.log('[Seed] Database already seeded. Skipping initial seed.');
    return;
  }

  const salt = bcrypt.genSaltSync(10);
  const passwordHashAdmin = bcrypt.hashSync('Admin@123456', salt);
  const passwordHashOps = bcrypt.hashSync('Ops@123456', salt);
  const passwordHashFinance = bcrypt.hashSync('Finance@123456', salt);
  const passwordHashAuditor = bcrypt.hashSync('Audit@123456', salt);

  db.transaction((tx) => {
    // 1. Insert Users
    tx.run(
      `INSERT INTO users (id, email, password_hash, full_name, role, mfa_enabled, last_login_at) VALUES 
      ('usr-super-admin', 'admin@centralcommand.io', ?, 'Chief SaaS Executive', 'SUPER_ADMIN', 1, datetime('now')),
      ('usr-ops-mgr', 'ops@centralcommand.io', ?, 'Operations Lead', 'OPERATIONS_MANAGER', 0, datetime('now', '-2 hours')),
      ('usr-finance-off', 'finance@centralcommand.io', ?, 'Senior Billing Comptroller', 'FINANCE_OFFICER', 0, datetime('now', '-1 day')),
      ('usr-sec-auditor', 'auditor@centralcommand.io', ?, 'Compliance & Security Auditor', 'AUDITOR', 0, datetime('now', '-3 days'))`,
      passwordHashAdmin, passwordHashOps, passwordHashFinance, passwordHashAuditor
    );

    // 2. Insert Subscription Plans
    tx.run(
      `INSERT INTO subscription_plans (id, code, name, description, tier_level, monthly_price, annual_price, max_students, max_teachers, max_storage_gb, features_json, modules_json) VALUES 
      ('plan-starter', 'STARTER', 'Starter Campus Edition', 'Ideal for boutique pre-primary and primary schools up to 500 students.', 1, 12000.00, 120000.00, 500, 40, 15, 
        '["Student Directory","Daily Attendance","Fee Billing & Receipts","Parent SMS Notifications","Basic Reports"]',
        '["admissions","attendance","fees","academics"]'
      ),
      ('plan-growth', 'GROWTH', 'Growth Academy Pro', 'Designed for established K-10 and K-12 secondary schools up to 1,500 students.', 2, 25000.00, 250000.00, 1500, 100, 50, 
        '["All Starter Features","Examination & Gradebook","Online Fee Gateway","Library Management","Teacher Payroll","Automated Backups"]',
        '["admissions","attendance","fees","academics","exams","library","payroll"]'
      ),
      ('plan-enterprise', 'ENTERPRISE', 'Enterprise Global Campus', 'Comprehensive multi-branch ERP suite for prestigious institutions up to 3,500 students.', 3, 55000.00, 550000.00, 3500, 250, 150, 
        '["All Growth Features","GPS Bus Tracking","Hostel Management","Inventory & Assets","Custom Report Engine","Priority 24/7 SLA","Dedicated Connector Bridge"]',
        '["admissions","attendance","fees","academics","exams","library","payroll","transport","hostel","inventory","reports"]'
      ),
      ('plan-custom', 'CUSTOM', 'Custom Multi-School Group', 'Bespoke high-scale deployment for educational trusts and mega institutions.', 4, 90000.00, 900000.00, 10000, 800, 500, 
        '["Unlimited Students & Staff","Custom ERP Modules","Dedicated Sync Server","On-premise / Hybrid Database Connector","White-label Custom Domain"]',
        '["admissions","attendance","fees","academics","exams","library","payroll","transport","hostel","inventory","reports","analytics"]'
      )`
    );

    // 3. Insert Schools
    tx.run(
      `INSERT INTO schools (
        id, code, name, logo_url, erp_url, address, city, state, country,
        owner_name, owner_email, owner_phone, tech_contact_name, tech_contact_email, tech_contact_phone,
        plan_id, billing_cycle, custom_price, subscription_start, subscription_end, grace_period_days, auto_suspend_enabled, payment_status,
        status, suspension_reason, suspended_at, active_modules_json,
        api_key, hmac_secret, ip_whitelist, last_sync_at, last_heartbeat_at, health_status
      ) VALUES 
      (
        'sch-xavier-01', 'SCH-XAVIER', 'St. Xavier''s International Academy',
        'https://images.unsplash.com/photo-1546410531-bb4caa6b424d?w=128&q=80', 'https://xavier.schools-erp.cloud',
        'Sector 21, Institutional Area', 'Gurugram', 'Haryana', 'India',
        'Fr. Anthony D''Souza', 'principal@stxaviers-gurugram.edu', '+91 98112 34567',
        'Rohan Sharma', 'sysadmin@stxaviers-gurugram.edu', '+91 98112 34568',
        'plan-enterprise', 'YEARLY', 550000.00, '2026-01-01', '2027-01-01', 10, 0, 'PAID',
        'ACTIVE', NULL, NULL, '["admissions","attendance","fees","academics","exams","library","payroll","transport","reports"]',
        'key_live_xav_90218f4a8b7c6d5e', 'sec_live_hmac_xav_secret_4892019a8b7c6d5e', '192.168.1.100,10.0.0.50',
        datetime('now', '-8 minutes'), datetime('now', '-2 minutes'), 'HEALTHY'
      ),
      (
        'sch-oakridge-02', 'SCH-OAKRIDGE', 'Oakridge Global Public School',
        'https://images.unsplash.com/photo-1580582932707-520aed937b7b?w=128&q=80', 'https://oakridge.schools-erp.cloud',
        'Khajaguda, Financial District', 'Hyderabad', 'Telangana', 'India',
        'Dr. Meenakshi Rao', 'director@oakridge-hyderabad.edu', '+91 98765 43210',
        'Vikram Naidu', 'it.head@oakridge-hyderabad.edu', '+91 98765 43211',
        'plan-growth', 'MONTHLY', 25000.00, '2026-09-01', '2026-10-31', 7, 1, 'OVERDUE',
        'ACTIVE', NULL, NULL, '["admissions","attendance","fees","academics","exams","library","payroll"]',
        'key_live_oak_71902a3b4c5d6e7f', 'sec_live_hmac_oak_secret_1234567a8b9c0d1e', '10.14.0.22',
        datetime('now', '-18 minutes'), datetime('now', '-4 minutes'), 'HEALTHY'
      ),
      (
        'sch-delhi-03', 'SCH-DELHI-HERITAGE', 'Delhi Heritage Model School',
        'https://images.unsplash.com/photo-1509062522246-3755977927d7?w=128&q=80', 'https://delhiheritage.schools-erp.cloud',
        'Plot 14, Vikas Puri', 'New Delhi', 'Delhi', 'India',
        'Prof. S. K. Aggarwal', 'manager@delhiheritage.org', '+91 99100 11223',
        'Sunil Verma', 'tech@delhiheritage.org', '+91 99100 11224',
        'plan-starter', 'QUARTERLY', 36000.00, '2026-06-01', '2026-09-01', 7, 1, 'OVERDUE',
        'SUSPENDED', 'Payment overdue for 72 days past 7-day grace period. Invoices INV-2026-003 and INV-2026-007 unpaid.', datetime('now', '-14 days'), '["admissions","attendance","fees","academics"]',
        'key_live_del_83910b2c3d4e5f6a', 'sec_live_hmac_del_secret_9988776655443322', '192.168.10.15',
        datetime('now', '-14 days'), datetime('now', '-14 days'), 'STALE'
      ),
      (
        'sch-vanguard-04', 'SCH-VANGUARD-STEM', 'Vanguard STEM World School',
        'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=128&q=80', 'https://vanguardstem.schools-erp.cloud',
        'Tech Village Ring Road, Marathahalli', 'Bengaluru', 'Karnataka', 'India',
        'Dr. Rajeshwar Hegde', 'trustee@vanguardstem.edu', '+91 94480 99887',
        'Ananya Krishnan', 'cto@vanguardstem.edu', '+91 94480 99888',
        'plan-enterprise', 'YEARLY', 550000.00, '2026-04-01', '2027-04-01', 14, 0, 'PAID',
        'ACTIVE', NULL, NULL, '["admissions","attendance","fees","academics","exams","library","payroll","transport","hostel","reports"]',
        'key_live_van_5647382910abcdef', 'sec_live_hmac_van_secret_aabbccddeeff0011', '172.16.5.90',
        datetime('now', '-12 minutes'), datetime('now', '-1 minute'), 'HEALTHY'
      ),
      (
        'sch-maplewood-05', 'SCH-MAPLEWOOD', 'Maplewood Preparatory High',
        'https://images.unsplash.com/photo-1577495508048-b635879837f1?w=128&q=80', 'https://maplewood.schools-erp.cloud',
        'Cantonment Road, Camp', 'Pune', 'Maharashtra', 'India',
        'Sarah Jenkins', 'principal@maplewoodprep.in', '+91 91234 56789',
        'Mahesh Patil', 'it@maplewoodprep.in', '+91 91234 56780',
        'plan-growth', 'MONTHLY', 25000.00, '2026-11-01', '2026-11-30', 5, 0, 'PENDING',
        'TRIAL', NULL, NULL, '["admissions","attendance","fees","academics","exams"]',
        'key_live_map_1029384756fedcba', 'sec_live_hmac_map_secret_1122334455667788', '192.168.4.88',
        datetime('now', '-35 minutes'), datetime('now', '-5 minutes'), 'HEALTHY'
      ),
      (
        'sch-greenvalley-06', 'SCH-GREEN-VALLEY', 'Green Valley Public School',
        'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=128&q=80', 'https://greenvalley.schools-erp.cloud',
        'Civil Lines, Circular Road', 'Jaipur', 'Rajasthan', 'India',
        'Harish Singhania', 'chairman@greenvalleyjaipur.ac.in', '+91 98290 12345',
        'Deepak Pareek', 'deepak@greenvalleyjaipur.ac.in', '+91 98290 12346',
        'plan-starter', 'HALF_YEARLY', 72000.00, '2026-07-01', '2027-01-01', 7, 0, 'PAID',
        'ACTIVE', NULL, NULL, '["admissions","attendance","fees","academics"]',
        'key_live_grn_9988776655443322', 'sec_live_hmac_grn_secret_9900112233445566', '192.168.8.20',
        datetime('now', '-42 minutes'), datetime('now', '-6 minutes'), 'HEALTHY'
      )`
    );

    // 4. Insert School Metrics (Real Synchronized ERP Stats)
    tx.run(
      `INSERT INTO school_sync_metrics (
        id, school_id, total_students, active_students, inactive_students, recent_admissions, departed_students,
        class_distribution_json, total_teachers, active_teachers, inactive_teachers, non_teaching_staff, recent_staff_hires,
        attendance_rate_pct, daily_active_logins, storage_used_mb, sync_timestamp
      ) VALUES 
      (
        'met-xav-01', 'sch-xavier-01', 1840, 1812, 28, 45, 12,
        '{"Grade 1": 150, "Grade 2": 155, "Grade 3": 160, "Grade 4": 158, "Grade 5": 162, "Grade 6": 155, "Grade 7": 150, "Grade 8": 145, "Grade 9": 155, "Grade 10": 152, "Grade 11": 148, "Grade 12": 150}',
        98, 96, 2, 42, 4, 94.6, 1420, 38400.0, datetime('now', '-8 minutes')
      ),
      (
        'met-oak-02', 'sch-oakridge-02', 960, 938, 22, 18, 5,
        '{"Grade 1": 80, "Grade 2": 82, "Grade 3": 85, "Grade 4": 80, "Grade 5": 84, "Grade 6": 82, "Grade 7": 80, "Grade 8": 78, "Grade 9": 76, "Grade 10": 75, "Grade 11": 78, "Grade 12": 80}',
        56, 54, 2, 26, 2, 91.8, 710, 18900.0, datetime('now', '-18 minutes')
      ),
      (
        'met-del-03', 'sch-delhi-03', 380, 365, 15, 0, 8,
        '{"Grade 1": 40, "Grade 2": 42, "Grade 3": 38, "Grade 4": 40, "Grade 5": 38, "Grade 6": 42, "Grade 7": 36, "Grade 8": 34, "Grade 9": 35, "Grade 10": 35}',
        24, 22, 2, 10, 0, 0.0, 0, 7200.0, datetime('now', '-14 days')
      ),
      (
        'met-van-04', 'sch-vanguard-04', 2450, 2410, 40, 68, 14,
        '{"Grade 1": 200, "Grade 2": 210, "Grade 3": 205, "Grade 4": 200, "Grade 5": 215, "Grade 6": 210, "Grade 7": 205, "Grade 8": 200, "Grade 9": 205, "Grade 10": 200, "Grade 11": 200, "Grade 12": 200}',
        134, 131, 3, 58, 6, 96.2, 1980, 52100.0, datetime('now', '-12 minutes')
      ),
      (
        'met-map-05', 'sch-maplewood-05', 720, 705, 15, 24, 3,
        '{"Grade 1": 60, "Grade 2": 62, "Grade 3": 60, "Grade 4": 58, "Grade 5": 62, "Grade 6": 60, "Grade 7": 58, "Grade 8": 60, "Grade 9": 60, "Grade 10": 60, "Grade 11": 60, "Grade 12": 60}',
        42, 40, 2, 18, 3, 89.4, 490, 11400.0, datetime('now', '-35 minutes')
      ),
      (
        'met-grn-06', 'sch-greenvalley-06', 490, 478, 12, 12, 4,
        '{"Grade 1": 48, "Grade 2": 50, "Grade 3": 48, "Grade 4": 52, "Grade 5": 48, "Grade 6": 50, "Grade 7": 46, "Grade 8": 48, "Grade 9": 50, "Grade 10": 50}',
        29, 28, 1, 14, 1, 92.1, 340, 8900.0, datetime('now', '-42 minutes')
      )`
    );

    // 5. Insert Invoices
    tx.run(
      `INSERT INTO invoices (
        id, invoice_number, school_id, plan_id, billing_cycle, period_start, period_end, issue_date, due_date,
        subtotal, tax_rate, tax_amount, total_amount, balance_due, status, notes
      ) VALUES 
      (
        'inv-2026-001', 'INV-2026-001', 'sch-xavier-01', 'plan-enterprise', 'YEARLY', '2026-01-01', '2027-01-01', '2025-12-15', '2026-01-05',
        550000.00, 18.0, 99000.00, 649000.00, 0.00, 'PAID', 'Annual ERP subscription for academic session 2026-27'
      ),
      (
        'inv-2026-002', 'INV-2026-002', 'sch-vanguard-04', 'plan-enterprise', 'YEARLY', '2026-04-01', '2027-04-01', '2026-03-15', '2026-04-01',
        550000.00, 18.0, 99000.00, 649000.00, 0.00, 'PAID', 'Enterprise ERP subscription with GPS Transport module add-on'
      ),
      (
        'inv-2026-003', 'INV-2026-003', 'sch-delhi-03', 'plan-starter', 'QUARTERLY', '2026-06-01', '2026-09-01', '2026-05-20', '2026-06-05',
        36000.00, 18.0, 6480.00, 42480.00, 42480.00, 'OVERDUE', 'Q2 subscription renewal - Overdue. Reminder escalated.'
      ),
      (
        'inv-2026-004', 'INV-2026-004', 'sch-oakridge-02', 'plan-growth', 'MONTHLY', '2026-10-01', '2026-10-31', '2026-09-25', '2026-10-05',
        25000.00, 18.0, 4500.00, 29500.00, 29500.00, 'OVERDUE', 'October 2026 monthly billing. In grace period.'
      ),
      (
        'inv-2026-005', 'INV-2026-005', 'sch-greenvalley-06', 'plan-starter', 'HALF_YEARLY', '2026-07-01', '2027-01-01', '2026-06-15', '2026-07-01',
        72000.00, 18.0, 12960.00, 84960.00, 0.00, 'PAID', 'H1 Half-yearly ERP license paid in full via RTGS'
      ),
      (
        'inv-2026-006', 'INV-2026-006', 'sch-maplewood-05', 'plan-growth', 'MONTHLY', '2026-11-01', '2026-11-30', '2026-10-28', '2026-11-15',
        25000.00, 18.0, 4500.00, 29500.00, 29500.00, 'PENDING', 'Trial conversion initial invoice. Payment expected on trial completion.'
      ),
      (
        'inv-2026-007', 'INV-2026-007', 'sch-delhi-03', 'plan-starter', 'QUARTERLY', '2026-09-01', '2026-12-01', '2026-08-20', '2026-09-05',
        36000.00, 18.0, 6480.00, 42480.00, 42480.00, 'OVERDUE', 'Q3 subscription invoice unpaid. Led to remote suspension.'
      )`
    );

    // 6. Insert Payments
    tx.run(
      `INSERT INTO payments (
        id, payment_number, invoice_id, school_id, amount, payment_date, payment_method, transaction_reference, status, recorded_by, notes
      ) VALUES 
      (
        'pay-2026-001', 'PAY-2026-001', 'inv-2026-001', 'sch-xavier-01', 649000.00, '2026-01-03', 'BANK_TRANSFER', 'HDFC_NEFT_20260103_098124', 'SUCCESSFUL', 'usr-finance-off', 'Verified against HDFC Bank corporate statement'
      ),
      (
        'pay-2026-002', 'PAY-2026-002', 'inv-2026-002', 'sch-vanguard-04', 649000.00, '2026-03-29', 'BANK_TRANSFER', 'ICICI_RTGS_20260329_448921', 'SUCCESSFUL', 'usr-finance-off', 'Annual renewal wire transfer credited'
      ),
      (
        'pay-2026-003', 'PAY-2026-003', 'inv-2026-005', 'sch-greenvalley-06', 84960.00, '2026-06-28', 'UPI', 'UPI_SBI_998124785123', 'SUCCESSFUL', 'usr-finance-off', 'Instant QR / UPI settlement acknowledged'
      )`
    );

    // 7. Insert Remote Commands (History & Execution Audit)
    tx.run(
      `INSERT INTO remote_commands (
        id, command_id, school_id, command_type, payload_json, status, issued_by, issued_at, expires_at, executed_at, result_log
      ) VALUES 
      (
        'cmd-rec-001', 'CMD-2026-10-881', 'sch-delhi-03', 'SUSPEND_SERVICE',
        '{"reason": "Non-payment of subscription fee for Q2 & Q3 (72 days past grace period)", "support_contact": "billing@centralcommand.io", "display_page": "SERVICE_SUSPENDED_OVERDUE", "allow_superadmin_bypass": true}',
        'EXECUTED', 'usr-super-admin', datetime('now', '-14 days'), datetime('now', '-13 days'), datetime('now', '-14 days', '+12 seconds'),
        'SUCCESS: Connector polled command CMD-2026-10-881. ERP local routing locked. Normal logins intercepted to /service-suspended. Support contact rendered. Database and file assets fully preserved.'
      ),
      (
        'cmd-rec-002', 'CMD-2026-11-102', 'sch-xavier-01', 'UPDATE_MODULES',
        '{"enabled_modules": ["admissions","attendance","fees","academics","exams","library","payroll","transport","reports"], "disabled_modules": ["hostel","inventory"]}',
        'EXECUTED', 'usr-ops-mgr', datetime('now', '-2 days'), datetime('now', '-1 day'), datetime('now', '-2 days', '+5 seconds'),
        'SUCCESS: Modules synchronized. ERP navigation updated to 9 enabled modules.'
      ),
      (
        'cmd-rec-003', 'CMD-2026-11-205', 'sch-vanguard-04', 'EXTEND_SUBSCRIPTION',
        '{"extend_days": 30, "reason": "Good customer incentive - annual renewal bonus"}',
        'EXECUTED', 'usr-super-admin', datetime('now', '-5 days'), datetime('now', '-4 days'), datetime('now', '-5 days', '+8 seconds'),
        'SUCCESS: Expiry date updated in school ERP license file to 2027-05-01.'
      )`
    );

    // 8. Insert Security Events (Centralized across all schools)
    tx.run(
      `INSERT INTO security_events (
        id, school_id, event_type, severity, user_identifier, ip_address, description, source_erp, metadata_json, created_at
      ) VALUES 
      (
        'sec-001', 'sch-oakridge-02', 'FAILED_LOGIN_ANOMALY', 'WARNING', 'admin@oakridge', '103.21.244.18',
        'Five consecutive failed login attempts detected on Principal Administrator account.', 'Oakridge ERP Connector',
        '{"attempts": 5, "account": "admin@oakridge", "action_taken": "Temporary 15-minute lock"}', datetime('now', '-4 hours')
      ),
      (
        'sec-002', 'sch-xavier-01', 'ADMIN_PASSWORD_RESET', 'INFO', 'sysadmin@stxaviers', '192.168.1.100',
        'Head IT Administrator performed self-service password reset with TOTP MFA verification.', 'St. Xavier ERP Connector',
        '{"method": "TOTP_MFA", "channel": "EMAIL_OTP"}', datetime('now', '-6 hours')
      ),
      (
        'sec-003', 'sch-delhi-03', 'REMOTE_SERVICE_SUSPENSION', 'CRITICAL', 'usr-super-admin', '14.139.24.8',
        'ERP service remotely suspended via Central ERP Command due to subscription default.', 'Central Command Daemon',
        '{"command_id": "CMD-2026-10-881", "balance_overdue": 84960.00}', datetime('now', '-14 days')
      ),
      (
        'sec-004', 'sch-vanguard-04', 'PRIVILEGE_ELEVATION', 'INFO', 'cto@vanguardstem.edu', '172.16.5.90',
        'Staff user promoted to Academic Dean role with examination marksheet modification privileges.', 'Vanguard ERP Connector',
        '{"promoted_user": "p.sharma@vanguardstem.edu", "role": "EXAM_CONTROLLER"}', datetime('now', '-1 day')
      ),
      (
        'sec-005', 'sch-oakridge-02', 'INTEGRATION_HMAC_VERIFIED', 'INFO', 'connector-agent', '10.14.0.22',
        'Hourly incremental synchronization bundle authenticated successfully with valid HMAC-SHA256 signature.', 'Central Integration Gateway',
        '{"payload_records": 1024, "latency_ms": 48}', datetime('now', '-18 minutes')
      ),
      (
        'sec-006', 'sch-maplewood-05', 'BULK_STUDENT_IMPORT', 'INFO', 'sarah.j@maplewoodprep', '192.168.4.88',
        'Initial onboarding import of 720 student records and class rosters completed.', 'Maplewood ERP Connector',
        '{"imported_count": 720, "errors": 0}', datetime('now', '-3 days')
      )`
    );

    // 9. Insert Central Administrative Audit Log
    tx.run(
      `INSERT INTO audit_logs (
        id, user_id, user_email, action, target_type, target_id, details_json, ip_address, created_at
      ) VALUES 
      ('aud-001', 'usr-super-admin', 'admin@centralcommand.io', 'REMOTE_COMMAND_DISPATCH', 'SCHOOL', 'sch-delhi-03', '{"command": "SUSPEND_SERVICE", "reason": "Overdue invoices"}', '127.0.0.1', datetime('now', '-14 days')),
      ('aud-002', 'usr-finance-off', 'finance@centralcommand.io', 'INVOICE_GENERATED', 'INVOICE', 'inv-2026-006', '{"school": "Maplewood", "amount": 29500.00}', '127.0.0.1', datetime('now', '-16 days')),
      ('aud-003', 'usr-finance-off', 'finance@centralcommand.io', 'PAYMENT_RECORDED', 'PAYMENT', 'pay-2026-002', '{"school": "Vanguard STEM", "amount": 649000.00}', '127.0.0.1', datetime('now', '-22 days')),
      ('aud-004', 'usr-ops-mgr', 'ops@centralcommand.io', 'CREDENTIALS_ROTATED', 'SCHOOL', 'sch-vanguard-04', '{"action": "HMAC secret rotated upon school request"}', '127.0.0.1', datetime('now', '-25 days'))`
    );

    // 10. Insert System Notifications
    tx.run(
      `INSERT INTO system_notifications (
        id, type, title, message, severity, school_id, is_read, action_url, metadata_json, created_at
      ) VALUES 
      ('notif-001', 'INVOICE_OVERDUE', 'Subscription Payment Overdue: Oakridge Global', 'Invoice INV-2026-004 for ₹29,500 is 38 days overdue. 7-day grace period has expired.', 'WARNING', 'sch-oakridge-02', 0, '/invoices', '{"invoice_id": "inv-2026-004"}', datetime('now', '-2 hours')),
      ('notif-002', 'SECURITY_ALERT', 'Brute Force Alert: Oakridge Global Public School', '5 failed login attempts in 2 minutes on administrator account. Temporary lock applied.', 'ERROR', 'sch-oakridge-02', 0, '/security', '{"ip": "103.21.244.18"}', datetime('now', '-4 hours')),
      ('notif-003', 'RENEWAL_UPCOMING', 'Upcoming Renewal: Maplewood Preparatory High', 'Trial subscription ending in 17 days. Conversion invoice INV-2026-006 issued.', 'INFO', 'sch-maplewood-05', 0, '/subscriptions', '{"end_date": "2026-11-30"}', datetime('now', '-1 day')),
      ('notif-004', 'SERVICE_SUSPENDED', 'Remote Suspension Active: Delhi Heritage Model School', 'ERP access currently blocked for school users due to unpaid invoices totaling ₹84,960.', 'CRITICAL', 'sch-delhi-03', 1, '/remote-controls', '{"command_id": "CMD-2026-10-881"}', datetime('now', '-14 days')),
      ('notif-005', 'SYNC_SUCCESS', 'Sync Health Normal: St. Xavier''s International', 'Daily academic census reconciled 1,840 students and 98 faculty with zero schema discrepancies.', 'INFO', 'sch-xavier-01', 1, '/schools', '{"students": 1840}', datetime('now', '-8 minutes'))`
    );

    // 11. Insert Configurable Automation Rules
    tx.run(
      `INSERT INTO automation_rules (
        id, code, name, description, trigger_type, condition_json, action_type, is_enabled, last_triggered_at
      ) VALUES 
      (
        'rule-pre-expiry-7d', 'RULE_PRE_EXPIRY_NOTIFY', 'Upcoming Subscription Expiry Warning (7 Days)',
        'Automatically dispatches payment reminder notifications to School Owner and Finance dashboard 7 days prior to subscription lapse.',
        'CRON_DAILY', '{"days_before_expiry": 7, "only_unpaid": true}', 'SEND_REMINDER_EMAIL_AND_NOTIF', 1, datetime('now', '-6 hours')
      ),
      (
        'rule-overdue-alert', 'RULE_OVERDUE_ALERT', 'Immediate Invoice Overdue Notification',
        'Flags any invoice that passes its due date without full settlement and triggers notification to Central Management.',
        'CRON_DAILY', '{"days_past_due": 1, "balance_gt": 0}', 'CREATE_SYSTEM_NOTIFICATION', 1, datetime('now', '-6 hours')
      ),
      (
        'rule-auto-suspend-optin', 'RULE_AUTO_SUSPEND_OPTIN', 'Auto-Suspension for Expired Grace Period (Opt-in Only)',
        'When enabled for a school, automatically enqueues SUSPEND_SERVICE command if payment is delinquent beyond school grace period.',
        'CRON_DAILY', '{"auto_suspend_flag_required": true, "grace_period_exceeded": true}', 'ENQUEUE_REMOTE_SUSPEND_COMMAND', 1, datetime('now', '-6 hours')
      ),
      (
        'rule-connector-heartbeat', 'RULE_CONNECTOR_HEARTBEAT_OFFLINE', 'Connector Telemetry Heartbeat Timeout (30 Mins)',
        'Marks school connection health as OFFLINE and raises alert if no telemetry or heartbeat has been received in 30 minutes.',
        'CRON_HOURLY', '{"inactive_minutes": 30}', 'MARK_HEALTH_OFFLINE_AND_ALERT', 1, datetime('now', '-1 hour')
      ),
      (
        'rule-24h-student-census', 'RULE_24H_STUDENT_CENSUS_CHECK', '24-Hour Automatic Student Census Reconciliation',
        'Automatically queries latest student enrollment counts every 24 hours and updates dynamic per-student subscription fees.',
        'CRON_24H', '{"interval_hours": 24}', 'RECONCILE_STUDENTS_AND_FEES', 1, datetime('now', '-25 hours')
      )`
    );

    // 12. Insert Telemetry History for Schools
    const schools = ['sch-xavier-01', 'sch-oakridge-02', 'sch-vanguard-04', 'sch-maplewood-05', 'sch-greenvalley-06'];
    for (const sid of schools) {
      for (let i = 5; i >= 0; i--) {
        const cpu = (15 + Math.random() * 25).toFixed(1);
        const mem = (40 + Math.random() * 20).toFixed(1);
        const disk = (30 + Math.random() * 15).toFixed(1);
        const resp = Math.floor(40 + Math.random() * 60);
        const sessions = Math.floor(50 + Math.random() * 200);
        tx.run(
          `INSERT INTO erp_telemetry_history (
            id, school_id, cpu_usage_pct, memory_usage_pct, disk_usage_pct, database_size_mb, response_time_ms, active_sessions, ping_timestamp
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now', ? || ' minutes'))`,
          `tel-${sid}-${i}`, sid, cpu, mem, disk, (sid === 'sch-vanguard-04' ? 52100 : 18500), resp, sessions, `-${i * 10}`
        );
      }
    }
  });

  console.log('[Seed] Database seeding completed successfully.');
}

if (require.main === module) {
  seedDatabase();
}

module.exports = seedDatabase;
