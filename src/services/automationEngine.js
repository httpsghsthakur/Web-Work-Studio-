const db = require('../database/db');
const commandQueueService = require('./commandQueueService');

class AutomationEngine {
  /**
   * Evaluate all active business rules
   */
  evaluateRules() {
    const rules = db.all('SELECT * FROM automation_rules WHERE is_enabled = 1');
    const results = [];

    for (const rule of rules) {
      try {
        let executionCount = 0;
        const condition = JSON.parse(rule.condition_json || '{}');

        if (rule.code === 'RULE_PRE_EXPIRY_NOTIFY') {
          // Find schools with subscription expiring within N days
          const days = condition.days_before_expiry || 7;
          const expiringSchools = db.all(
            `SELECT id, name, subscription_end, owner_email 
             FROM schools 
             WHERE status = 'ACTIVE' 
               AND ROUND(julianday(subscription_end) - julianday('now')) BETWEEN 0 AND ?`,
            days
          );

          for (const sch of expiringSchools) {
            // Check if notification already issued in last 24h
            const existing = db.get(
              `SELECT id FROM system_notifications 
               WHERE school_id = ? AND type = 'EXPIRY_REMINDER' 
                 AND datetime(created_at) > datetime('now', '-24 hours')`,
              sch.id
            );
            if (!existing) {
              db.run(
                `INSERT INTO system_notifications (id, type, title, message, severity, school_id, action_url)
                 VALUES (?, 'EXPIRY_REMINDER', 'Upcoming Subscription Expiry', ?, 'WARNING', ?, '/subscriptions')`,
                `notif-exp-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
                `Subscription for ${sch.name} expires on ${sch.subscription_end}. Renewal action recommended.`,
                sch.id
              );
              executionCount++;
            }
          }
        } else if (rule.code === 'RULE_OVERDUE_ALERT') {
          // Find unpaid overdue invoices
          const overdueInvoices = db.all(
            `SELECT i.id, i.invoice_number, i.balance_due, s.id as school_id, s.name as school_name 
             FROM invoices i
             JOIN schools s ON i.school_id = s.id
             WHERE i.status = 'OVERDUE' AND i.balance_due > 0`
          );

          for (const inv of overdueInvoices) {
            const existing = db.get(
              `SELECT id FROM system_notifications 
               WHERE school_id = ? AND type = 'INVOICE_OVERDUE' 
                 AND datetime(created_at) > datetime('now', '-24 hours')`,
              inv.school_id
            );
            if (!existing) {
              db.run(
                `INSERT INTO system_notifications (id, type, title, message, severity, school_id, action_url)
                 VALUES (?, 'INVOICE_OVERDUE', 'Invoice Delinquent', ?, 'WARNING', ?, '/invoices')`,
                `notif-ovd-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
                `Invoice ${inv.invoice_number} for ${inv.school_name} (₹${inv.balance_due.toLocaleString()}) is overdue.`,
                inv.school_id
              );
              executionCount++;
            }
          }
        } else if (rule.code === 'RULE_AUTO_SUSPEND_OPTIN') {
          // Find schools with auto_suspend_enabled = 1 where grace period has elapsed and payment is overdue
          const delinquentSchools = db.all(`
            SELECT s.id, s.name, s.grace_period_days, s.subscription_end, s.payment_status
            FROM schools s
            WHERE s.auto_suspend_enabled = 1 
              AND s.status = 'ACTIVE' 
              AND s.payment_status = 'OVERDUE'
              AND julianday('now') > julianday(s.subscription_end, '+' || s.grace_period_days || ' days')
          `);

          for (const sch of delinquentSchools) {
            commandQueueService.enqueueCommand({
              schoolId: sch.id,
              commandType: 'SUSPEND_SERVICE',
              payload: {
                reason: `Automatic policy: subscription overdue beyond ${sch.grace_period_days} day grace period.`,
                display_page: 'SERVICE_SUSPENDED_OVERDUE',
                automated: true
              },
              issuedBy: 'AUTOMATION_ENGINE'
            });
            executionCount++;
          }
        } else if (rule.code === 'RULE_CONNECTOR_HEARTBEAT_OFFLINE') {
          // Schools that haven't pinged in 30+ minutes
          const offlineSchools = db.all(`
            SELECT id, name, last_heartbeat_at 
            FROM schools 
            WHERE status = 'ACTIVE' 
              AND health_status != 'OFFLINE'
              AND (last_heartbeat_at IS NULL OR julianday('now') - julianday(last_heartbeat_at) > (30.0 / 1440.0))
          `);

          for (const sch of offlineSchools) {
            db.run("UPDATE schools SET health_status = 'OFFLINE' WHERE id = ?", sch.id);
            db.run(
              `INSERT INTO system_notifications (id, type, title, message, severity, school_id, action_url)
               VALUES (?, 'CONNECTOR_OFFLINE', 'Connector Heartbeat Lost', ?, 'WARNING', ?, '/erp-monitoring')`,
              `notif-hb-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
              `School ERP connector for ${sch.name} has not reported heartbeat for over 30 minutes.`,
              sch.id
            );
            executionCount++;
          }
        } else if (rule.code === 'RULE_24H_STUDENT_CENSUS_CHECK') {
          // Schools needing 24-hour student census check & subscription recalculation
          const dueSchools = db.all(`
            SELECT id, name, last_student_check_at, pricing_model, price_per_student, billing_cycle
            FROM schools
            WHERE last_student_check_at IS NULL 
               OR (julianday('now') - julianday(last_student_check_at)) >= 1.0
          `);

          for (const sch of dueSchools) {
            const rec = this.reconcileSchoolStudentCensus(sch.id);
            db.run(
              `INSERT INTO system_notifications (id, type, title, message, severity, school_id, action_url)
               VALUES (?, '24H_STUDENT_CENSUS', '24h Student Census Verified', ?, 'INFO', ?, '/schools')`,
              `notif-cen-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
              `24h census verified for ${sch.name}: ${rec.studentCount} students @ ₹${rec.pricePerStudent}/mo. Calculated subscription amount: ₹${rec.calculatedAmount.toLocaleString()}.`,
              sch.id
            );
            executionCount++;
          }
        }

        // Update rule last_triggered_at
        db.run("UPDATE automation_rules SET last_triggered_at = datetime('now') WHERE id = ?", rule.id);
        results.push({ ruleCode: rule.code, status: 'SUCCESS', actionsTaken: executionCount });
      } catch (err) {
        console.error(`[Automation Engine Error] Rule ${rule.code}:`, err);
        results.push({ ruleCode: rule.code, status: 'ERROR', error: err.message });
      }
    }

    return results;
  }

  /**
   * Reconcile latest student count and automatically compute amount to pay by the school
   */
  reconcileSchoolStudentCensus(schoolId) {
    const school = db.get('SELECT * FROM schools WHERE id = ?', schoolId);
    if (!school) throw new Error(`School ${schoolId} not found`);

    const latestMetric = db.get(
      'SELECT total_students, active_students FROM school_sync_metrics WHERE school_id = ? ORDER BY sync_timestamp DESC, rowid DESC LIMIT 1',
      schoolId
    );

    const studentCount = latestMetric ? latestMetric.total_students : 0;
    const cycleMultiplier = school.billing_cycle === 'YEARLY' ? 12
      : school.billing_cycle === 'HALF_YEARLY' ? 6
      : school.billing_cycle === 'QUARTERLY' ? 3
      : 1;

    let calculatedAmount = 0;
    if (school.pricing_model === 'PER_STUDENT') {
      const rate = school.price_per_student !== undefined && school.price_per_student !== null
        ? parseFloat(school.price_per_student)
        : 25.0;
      calculatedAmount = Math.round(studentCount * rate * cycleMultiplier);
    } else {
      calculatedAmount = school.custom_price || 0;
    }

    db.run(
      "UPDATE schools SET calculated_subscription_amount = ?, last_student_check_at = datetime('now'), updated_at = datetime('now') WHERE id = ?",
      calculatedAmount, school.id
    );

    return {
      schoolId: school.id,
      schoolName: school.name,
      code: school.code,
      pricingModel: school.pricing_model || 'PER_STUDENT',
      pricePerStudent: school.price_per_student || 25.0,
      studentCount,
      activeStudents: latestMetric ? latestMetric.active_students : 0,
      billingCycle: school.billing_cycle,
      cycleMultiplier,
      calculatedAmount,
      lastStudentCheckAt: new Date().toISOString()
    };
  }
}

module.exports = new AutomationEngine();
