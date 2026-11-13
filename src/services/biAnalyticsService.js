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
        s.pricing_model, s.price_per_student, s.calculated_subscription_amount, s.approval_status,
        s.subscription_start, s.subscription_end, s.last_sync_at, s.health_status,
        p.name as plan_name,
        COALESCE(m.total_students, 0) as students,
        COALESCE(m.active_students, 0) as active_students,
        COALESCE(m.inactive_students, 0) as inactive_students,
        COALESCE(m.recent_admissions, 0) as recent_admissions,
        COALESCE(m.departed_students, 0) as departed_students,
        COALESCE(m.total_teachers, 0) as teachers,
        COALESCE(m.active_teachers, 0) as active_teachers,
        COALESCE(m.non_teaching_staff, 0) as staff,
        COALESCE(m.attendance_rate_pct, 0) as attendance_rate,
        COALESCE(m.daily_active_logins, 0) as daily_logins,
        COALESCE(m.storage_used_mb, 0) as storage_mb,
        m.class_distribution_json,
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

    return list.map(s => {
      const ratio = s.teachers > 0 ? (s.students / s.teachers).toFixed(1) : 'N/A';
      const efficiency = s.total_invoiced > 0 ? ((s.total_paid / s.total_invoiced) * 100).toFixed(1) : 100;
      return {
        ...s,
        student_teacher_ratio: ratio,
        collection_efficiency: parseFloat(efficiency),
        pricing_model: s.pricing_model || 'PER_STUDENT',
        price_per_student: s.price_per_student || 25.0
      };
    });
  }

  /**
   * Detailed Financial & Invoicing Ledger Report
   */
  getFinancialLedger() {
    return db.all(`
      SELECT 
        i.id as invoice_id,
        i.invoice_number,
        i.issue_date,
        i.due_date,
        i.subtotal,
        i.tax_amount,
        i.total_amount,
        i.balance_due,
        i.status as invoice_status,
        i.billing_cycle,
        i.period_start,
        i.period_end,
        s.id as school_id,
        s.code as school_code,
        s.name as school_name,
        s.city,
        s.pricing_model,
        s.price_per_student,
        p.name as plan_name,
        COALESCE(pay.total_payments, 0) as total_payments,
        pay.latest_payment_date,
        pay.latest_payment_reference,
        pay.latest_payment_method
      FROM invoices i
      INNER JOIN schools s ON i.school_id = s.id
      LEFT JOIN subscription_plans p ON i.plan_id = p.id
      LEFT JOIN (
        SELECT 
          invoice_id,
          SUM(amount) as total_payments,
          MAX(payment_date) as latest_payment_date,
          MAX(transaction_reference) as latest_payment_reference,
          MAX(payment_method) as latest_payment_method
        FROM payments
        WHERE status = 'SUCCESSFUL'
        GROUP BY invoice_id
      ) pay ON i.id = pay.invoice_id
      ORDER BY i.issue_date DESC
    `);
  }

  /**
   * Detailed Academic Census & Capacity Report
   */
  getAcademicCensusReport() {
    const rows = db.all(`
      SELECT 
        s.id as school_id,
        s.code as school_code,
        s.name as school_name,
        s.city,
        s.state,
        s.status as operational_status,
        s.pricing_model,
        s.price_per_student,
        p.name as plan_name,
        COALESCE(m.total_students, 0) as total_students,
        COALESCE(m.active_students, 0) as active_students,
        COALESCE(m.inactive_students, 0) as inactive_students,
        COALESCE(m.recent_admissions, 0) as recent_admissions,
        COALESCE(m.departed_students, 0) as departed_students,
        COALESCE(m.total_teachers, 0) as total_teachers,
        COALESCE(m.active_teachers, 0) as active_teachers,
        COALESCE(m.non_teaching_staff, 0) as non_teaching_staff,
        COALESCE(m.attendance_rate_pct, 0) as attendance_rate,
        COALESCE(m.daily_active_logins, 0) as daily_logins,
        COALESCE(m.storage_used_mb, 0) as storage_used_mb,
        m.class_distribution_json,
        m.sync_timestamp,
        m.sync_source
      FROM schools s
      LEFT JOIN subscription_plans p ON s.plan_id = p.id
      LEFT JOIN (
        SELECT m1.* FROM school_sync_metrics m1
        INNER JOIN (
          SELECT school_id, MAX(sync_timestamp) as max_sync 
          FROM school_sync_metrics GROUP BY school_id
        ) m2 ON m1.school_id = m2.school_id AND m1.sync_timestamp = m2.max_sync
      ) m ON s.id = m.school_id
      ORDER BY total_students DESC
    `);

    return rows.map(r => ({
      ...r,
      student_teacher_ratio: r.total_teachers > 0 ? (r.total_students / r.total_teachers).toFixed(1) : 'N/A',
      class_distribution: JSON.parse(r.class_distribution_json || '{}')
    }));
  }

  /**
   * Centralized Security & Compliance Audit Report
   */
  getSecurityAuditReport() {
    return db.all(`
      SELECT 
        e.id,
        e.event_type,
        e.severity,
        e.user_identifier,
        e.ip_address,
        e.description,
        e.source_erp,
        e.created_at,
        s.id as school_id,
        s.name as school_name,
        s.code as school_code,
        s.erp_url
      FROM security_events e
      LEFT JOIN schools s ON e.school_id = s.id
      ORDER BY e.created_at DESC
      LIMIT 300
    `);
  }

  /**
   * Deep Multi-Dimensional Analytics Hub
   */
  getDeepAnalytics() {
    const comparison = this.getComparativeAnalytics();
    const executive = this.getExecutiveDashboard();

    const wingDistribution = {
      "Primary Wing (Grades 1-5)": 0,
      "Middle Wing (Grades 6-8)": 0,
      "Secondary Wing (Grades 9-10)": 0,
      "Senior Secondary (Grades 11-12)": 0
    };

    comparison.forEach(s => {
      try {
        const dist = JSON.parse(s.class_distribution_json || '{}');
        Object.entries(dist).forEach(([k, v]) => {
          const lower = k.toLowerCase();
          const num = parseInt(v, 10) || 0;
          if (lower.includes('1-5') || lower.includes('primary') || lower.includes('1 to 5')) wingDistribution["Primary Wing (Grades 1-5)"] += num;
          else if (lower.includes('6-8') || lower.includes('middle') || lower.includes('6 to 8')) wingDistribution["Middle Wing (Grades 6-8)"] += num;
          else if (lower.includes('9') && !lower.includes('11') || lower.includes('secondary') && !lower.includes('senior')) wingDistribution["Secondary Wing (Grades 9-10)"] += num;
          else if (lower.includes('11') || lower.includes('12') || lower.includes('senior')) wingDistribution["Senior Secondary (Grades 11-12)"] += num;
          else wingDistribution["Primary Wing (Grades 1-5)"] += num;
        });
      } catch {}
    });

    const totalInvoiced = comparison.reduce((sum, s) => sum + (s.total_invoiced || 0), 0);
    const totalPaid = comparison.reduce((sum, s) => sum + (s.total_paid || 0), 0);
    const totalOutstanding = comparison.reduce((sum, s) => sum + (s.outstanding_balance || 0), 0);
    const collectionEfficiency = totalInvoiced > 0 ? ((totalPaid / totalInvoiced) * 100).toFixed(1) : 100;

    const totalStudents = comparison.reduce((sum, s) => sum + (s.students || 0), 0);
    const totalTeachers = comparison.reduce((sum, s) => sum + (s.teachers || 0), 0);
    const networkRatio = totalTeachers > 0 ? (totalStudents / totalTeachers).toFixed(1) : '0';

    const activeAttendance = comparison.filter(s => s.attendance_rate > 0);
    const avgAttendance = activeAttendance.length > 0
      ? (activeAttendance.reduce((sum, s) => sum + s.attendance_rate, 0) / activeAttendance.length).toFixed(1)
      : '0.0';

    return {
      executive,
      matrix: comparison,
      wingDistribution,
      kpis: {
        totalSchools: comparison.length,
        totalStudents,
        totalTeachers,
        networkRatio,
        avgAttendance,
        totalInvoiced,
        totalPaid,
        totalOutstanding,
        collectionEfficiency
      }
    };
  }
}

module.exports = new BIAnalyticsService();
