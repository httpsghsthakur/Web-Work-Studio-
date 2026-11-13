const db = require('../database/db');

class BIAnalyticsService {
  /**
   * Get main SaaS Owner executive overview KPIs and charts
   */
  getExecutiveDashboard() {
    // 1. School Counts by Status
    const schoolStats = db.get(`
      SELECT 
        COUNT(*) as total_schools,
        SUM(CASE WHEN status = 'ACTIVE' THEN 1 ELSE 0 END) as active_schools,
        SUM(CASE WHEN status = 'SUSPENDED' THEN 1 ELSE 0 END) as suspended_schools,
        SUM(CASE WHEN status = 'TRIAL' THEN 1 ELSE 0 END) as trial_schools,
        SUM(CASE WHEN status = 'PENDING_SETUP' THEN 1 ELSE 0 END) as pending_schools,
        SUM(CASE WHEN health_status = 'HEALTHY' THEN 1 ELSE 0 END) as healthy_erps,
        SUM(CASE WHEN health_status = 'DEGRADED' THEN 1 ELSE 0 END) as degraded_erps,
        SUM(CASE WHEN health_status IN ('OFFLINE', 'STALE') THEN 1 ELSE 0 END) as offline_or_stale_erps
      FROM schools
    `);

    // 2. Aggregated Student and Staff Census (from latest synchronized metrics)
    const censusStats = db.get(`
      SELECT 
        COALESCE(SUM(total_students), 0) as total_students,
        COALESCE(SUM(active_students), 0) as total_active_students,
        COALESCE(SUM(inactive_students), 0) as total_inactive_students,
        COALESCE(SUM(recent_admissions), 0) as total_recent_admissions,
        COALESCE(SUM(departed_students), 0) as total_departed_students,
        COALESCE(SUM(total_teachers), 0) as total_teachers,
        COALESCE(SUM(active_teachers), 0) as total_active_teachers,
        COALESCE(SUM(non_teaching_staff), 0) as total_non_teaching_staff,
        COALESCE(SUM(daily_active_logins), 0) as total_daily_active_logins,
        COALESCE(SUM(storage_used_mb), 0) as total_storage_mb
      FROM (
        SELECT m.* FROM school_sync_metrics m
        INNER JOIN (
          SELECT school_id, MAX(sync_timestamp) as max_sync 
          FROM school_sync_metrics 
          GROUP BY school_id
        ) latest ON m.school_id = latest.school_id AND m.sync_timestamp = latest.max_sync
      )
    `);

    // 3. Financial MRR, ARR, Total Revenue, and Overdue Receivables
    // MRR calculation based on active/trial schools and their billing cycles
    const schoolsList = db.all(`
      SELECT s.id, s.billing_cycle, s.custom_price, p.monthly_price, p.annual_price, s.status, s.payment_status
      FROM schools s
      LEFT JOIN subscription_plans p ON s.plan_id = p.id
    `);

    let mrr = 0;
    schoolsList.forEach(sch => {
      if (sch.status === 'ACTIVE' || sch.status === 'TRIAL') {
        const monthlyBase = sch.custom_price 
          ? (sch.billing_cycle === 'YEARLY' ? sch.custom_price / 12 
             : sch.billing_cycle === 'HALF_YEARLY' ? sch.custom_price / 6 
             : sch.billing_cycle === 'QUARTERLY' ? sch.custom_price / 3 
             : sch.custom_price)
          : (sch.billing_cycle === 'YEARLY' ? (sch.annual_price || 0) / 12 
             : (sch.monthly_price || 0));
        mrr += monthlyBase;
      }
    });
    mrr = Math.round(mrr);
    const arr = mrr * 12;

    // Total collected revenue from completed payments
    const revenueStats = db.get(`
      SELECT COALESCE(SUM(amount), 0) as total_revenue_collected
      FROM payments
      WHERE status = 'SUCCESSFUL'
    `);

    // Total outstanding receivables from unpaid/overdue invoices
    const overdueStats = db.get(`
      SELECT 
        COALESCE(SUM(balance_due), 0) as total_outstanding,
        COALESCE(SUM(CASE WHEN status = 'OVERDUE' THEN balance_due ELSE 0 END), 0) as overdue_amount,
        COUNT(CASE WHEN status = 'OVERDUE' THEN 1 ELSE NULL END) as overdue_invoices_count,
        COUNT(CASE WHEN status = 'PENDING' THEN 1 ELSE NULL END) as pending_invoices_count
      FROM invoices
      WHERE status IN ('PENDING', 'OVERDUE', 'PARTIALLY_PAID')
    `);

    // 4. Renewals Approaching (next 30 days)
    const upcomingRenewals = db.all(`
      SELECT s.id, s.name, s.code, s.subscription_end, s.billing_cycle, s.payment_status,
             ROUND(julianday(s.subscription_end) - julianday('now')) as days_remaining,
             p.name as plan_name
      FROM schools s
      LEFT JOIN subscription_plans p ON s.plan_id = p.id
      WHERE julianday(s.subscription_end) - julianday('now') BETWEEN 0 AND 30
      ORDER BY s.subscription_end ASC
    `);

    // 5. Chart Data: School-wise Student & Teacher Distribution
    const schoolDistribution = db.all(`
      SELECT 
        s.id, s.name, s.code, s.status, s.last_sync_at, s.health_status,
        COALESCE(m.total_students, 0) as students,
        COALESCE(m.total_teachers, 0) as teachers,
        COALESCE(m.attendance_rate_pct, 0) as attendance_rate,
        COALESCE(m.daily_active_logins, 0) as daily_logins,
        COALESCE(m.storage_used_mb, 0) as storage_mb
      FROM schools s
      LEFT JOIN (
        SELECT m1.* FROM school_sync_metrics m1
        INNER JOIN (
          SELECT school_id, MAX(sync_timestamp) as max_sync 
          FROM school_sync_metrics GROUP BY school_id
        ) m2 ON m1.school_id = m2.school_id AND m1.sync_timestamp = m2.max_sync
      ) m ON s.id = m.school_id
      ORDER BY students DESC
    `);

    // 6. Monthly Revenue Trend (grouped by month of payment)
    const monthlyRevenue = db.all(`
      SELECT 
        strftime('%Y-%m', payment_date) as month,
        SUM(amount) as revenue
      FROM payments
      WHERE status = 'SUCCESSFUL'
      GROUP BY strftime('%Y-%m', payment_date)
      ORDER BY month ASC
      LIMIT 12
    `);

    // 7. Recent Security Events
    const recentSecurityEvents = db.all(`
      SELECT e.*, s.name as school_name, s.code as school_code
      FROM security_events e
      LEFT JOIN schools s ON e.school_id = s.id
      ORDER BY e.created_at DESC
      LIMIT 6
    `);

    // 8. Recent School Actions (Audit)
    const recentAudits = db.all(`
      SELECT a.*, u.full_name as user_name
      FROM audit_logs a
      LEFT JOIN users u ON a.user_id = u.id
      ORDER BY a.created_at DESC
      LIMIT 6
    `);

    return {
      overview: {
        schools: schoolStats,
        census: censusStats,
        financial: {
          mrr: Math.round(mrr),
          arr: Math.round(arr),
          totalRevenueCollected: revenueStats.total_revenue_collected,
          totalOutstanding: overdueStats.total_outstanding,
          overdueAmount: overdueStats.overdue_amount,
          overdueInvoicesCount: overdueStats.overdue_invoices_count,
          pendingInvoicesCount: overdueStats.pending_invoices_count,
        },
        systemHealth: {
          overallStatus: schoolStats.suspended_schools > 0 ? 'ATTENTION_NEEDED' : 'OPERATIONAL',
          healthyCount: schoolStats.healthy_erps,
          degradedCount: schoolStats.degraded_erps,
          offlineCount: schoolStats.offline_or_stale_erps,
        },
        upcomingRenewalsCount: upcomingRenewals.length,
      },
      upcomingRenewals,
      charts: {
        schoolDistribution,
        monthlyRevenue,
      },
      recentSecurityEvents,
      recentAudits,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Comparative School Analytics Matrix
   */
  getComparativeAnalytics() {
    const list = db.all(`
      SELECT 
        s.id, s.code, s.name, s.city, s.state, s.status, s.payment_status, s.billing_cycle,
        s.subscription_start, s.subscription_end, s.last_sync_at, s.health_status,
        p.name as plan_name,
        COALESCE(m.total_students, 0) as students,
        COALESCE(m.active_students, 0) as active_students,
        COALESCE(m.recent_admissions, 0) as recent_admissions,
        COALESCE(m.departed_students, 0) as departed_students,
        COALESCE(m.total_teachers, 0) as teachers,
        COALESCE(m.non_teaching_staff, 0) as staff,
        COALESCE(m.attendance_rate_pct, 0) as attendance_rate,
        COALESCE(m.daily_active_logins, 0) as daily_logins,
        COALESCE(m.storage_used_mb, 0) as storage_mb,
        COALESCE(inv_summary.total_invoiced, 0) as total_invoiced,
        COALESCE(pay_summary.total_paid, 0) as total_paid,
        COALESCE(inv_summary.outstanding, 0) as outstanding_balance
      FROM schools s
      LEFT JOIN subscription_plans p ON s.plan_id = p.id
      LEFT JOIN (
        SELECT m1.* FROM school_sync_metrics m1
        INNER JOIN (
          SELECT school_id, MAX(sync_timestamp) as max_sync 
          FROM school_sync_metrics GROUP BY school_id
        ) m2 ON m1.school_id = m2.school_id AND m1.sync_timestamp = m2.max_sync
      ) m ON s.id = m.school_id
      LEFT JOIN (
        SELECT school_id, SUM(total_amount) as total_invoiced, SUM(balance_due) as outstanding
        FROM invoices GROUP BY school_id
      ) inv_summary ON s.id = inv_summary.school_id
      LEFT JOIN (
        SELECT school_id, SUM(amount) as total_paid
        FROM payments WHERE status = 'SUCCESSFUL' GROUP BY school_id
      ) pay_summary ON s.id = pay_summary.school_id
      ORDER BY students DESC
    `);

    return list;
  }
}

module.exports = new BIAnalyticsService();
