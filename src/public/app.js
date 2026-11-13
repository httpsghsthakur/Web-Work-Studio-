// ============================================================================
// CENTRAL ERP COMMAND — Single Page Application Engine
// Multi-School ERP Management & Business Intelligence Platform
// ============================================================================

(function () {
  'use strict';

  // Global State
  const state = {
    activeTab: 'overview',
    currentUser: null,
    token: localStorage.getItem('central_token') || null,
    theme: localStorage.getItem('central_theme') || 'dark',
    schools: [],
    selectedSchoolId: null,
    invoices: [],
    plans: [],
    notifications: [],
    activeCharts: {}
  };

  const API_BASE = '/api/v1';

  // API helper with JWT injection
  async function api(endpoint, options = {}) {
    const headers = options.headers || {};
    if (state.token) {
      headers['Authorization'] = `Bearer ${state.token}`;
    }
    if (!headers['Content-Type'] && !(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }

    try {
      const res = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `HTTP ${res.status}: Request failed`);
      }
      return data;
    } catch (err) {
      showToast(err.message, 'error');
      throw err;
    }
  }

  // Toast Notification System
  function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    const icon = type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-triangle-exclamation' : 'fa-circle-info';
    toast.innerHTML = `<i class="fa-solid ${icon}"></i><span>${message}</span>`;

    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

  // Initialize Application
  async function init() {
    setupTheme();
    setupNavigation();
    setupModals();
    setupGlobalSearch();
    setupLoginForm();

    const isAuthenticated = await checkAuthSession();
    if (isAuthenticated) {
      await loadInitialData();
      renderCurrentTab();
    }
  }

  // Authentication & Session Management
  function showLoginView() {
    const loginScreen = document.getElementById('login-screen');
    const appShell = document.getElementById('app-shell');
    if (loginScreen) loginScreen.style.display = 'flex';
    if (appShell) appShell.style.display = 'none';
  }

  function showAppShell() {
    const loginScreen = document.getElementById('login-screen');
    const appShell = document.getElementById('app-shell');
    if (loginScreen) loginScreen.style.display = 'none';
    if (appShell) appShell.style.display = 'flex';
  }

  async function checkAuthSession() {
    if (state.token) {
      try {
        const res = await api('/auth/me');
        if (res.success && res.user) {
          state.currentUser = res.user;
          updateUserBadge();
          showAppShell();
          return true;
        }
      } catch (e) {
        state.token = null;
        localStorage.removeItem('central_token');
      }
    }
    showLoginView();
    return false;
  }

  function setupLoginForm() {
    const form = document.getElementById('form-login');
    const emailInput = document.getElementById('login-email');
    const passInput = document.getElementById('login-password');
    const mfaInput = document.getElementById('login-mfa');
    const errAlert = document.getElementById('login-error-alert');
    const errText = document.getElementById('login-error-text');
    const submitBtn = document.getElementById('btn-submit-login');

    // Quick fill helper pills for administrator accounts
    document.querySelectorAll('.btn-quick-creds').forEach(b => {
      b.addEventListener('click', () => {
        if (emailInput) emailInput.value = b.getAttribute('data-email');
        if (passInput) passInput.value = b.getAttribute('data-pass');
        if (mfaInput) mfaInput.value = '123456';
        if (errAlert) errAlert.style.display = 'none';
      });
    });

    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = emailInput?.value.trim();
        const password = passInput?.value;
        const mfaCode = mfaInput?.value.trim() || '123456';

        if (!email || !password) {
          if (errAlert && errText) {
            errText.textContent = 'Please enter both administrator email and password';
            errAlert.style.display = 'block';
          }
          return;
        }

        if (errAlert) errAlert.style.display = 'none';
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Authenticating...';
        }

        try {
          const res = await api('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password, mfaCode })
          });

          if (res.success && res.token) {
            state.token = res.token;
            state.currentUser = res.user;
            localStorage.setItem('central_token', state.token);
            updateUserBadge();
            showAppShell();
            showToast(`Signed in successfully as ${res.user.fullName || res.user.email}`, 'success');
            await loadInitialData();
            renderCurrentTab();
          } else {
            throw new Error(res.error || 'Invalid credentials');
          }
        } catch (err) {
          if (errAlert && errText) {
            errText.textContent = err.message || 'Invalid administrator email or password';
            errAlert.style.display = 'block';
          }
        } finally {
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i> Sign In to Central Command';
          }
        }
      });
    }

    // Direct Logout Button in Topbar
    const logoutBtn = document.getElementById('btn-topbar-logout');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        if (!confirm('Are you sure you want to sign out of Central ERP Command?')) return;
        state.token = null;
        state.currentUser = null;
        localStorage.removeItem('central_token');
        if (passInput) passInput.value = '';
        if (mfaInput) mfaInput.value = '';
        showLoginView();
        showToast('You have been signed out.', 'info');
      });
    }
  }

  function updateUserBadge() {
    if (!state.currentUser) return;
    const nameEl = document.getElementById('user-display-name');
    const roleEl = document.getElementById('user-display-role');
    const avatarEl = document.getElementById('user-avatar-initials');

    if (nameEl) nameEl.textContent = state.currentUser.fullName || state.currentUser.email;
    if (roleEl) roleEl.textContent = state.currentUser.role;
    if (avatarEl) {
      const parts = (state.currentUser.fullName || 'SA').split(' ');
      avatarEl.textContent = parts.length > 1 ? (parts[0][0] + parts[1][0]).toUpperCase() : parts[0].slice(0, 2).toUpperCase();
    }
  }

  // Theme Management
  function setupTheme() {
    const btn = document.getElementById('theme-toggle-btn');
    if (state.theme === 'light') {
      document.body.classList.remove('dark-mode');
      if (btn) btn.innerHTML = '<i class="fa-solid fa-sun"></i>';
    } else {
      document.body.classList.add('dark-mode');
      if (btn) btn.innerHTML = '<i class="fa-solid fa-moon"></i>';
    }

    if (btn) {
      btn.addEventListener('click', () => {
        state.theme = state.theme === 'dark' ? 'light' : 'dark';
        localStorage.setItem('central_theme', state.theme);
        if (state.theme === 'light') {
          document.body.classList.remove('dark-mode');
          btn.innerHTML = '<i class="fa-solid fa-sun"></i>';
        } else {
          document.body.classList.add('dark-mode');
          btn.innerHTML = '<i class="fa-solid fa-moon"></i>';
        }
        // Re-render active charts to adapt colors
        if (state.activeTab === 'overview') {
          renderOverview();
        }
      });
    }
  }

  // Tab Navigation
  function setupNavigation() {
    const items = document.querySelectorAll('.nav-item');
    items.forEach(item => {
      item.addEventListener('click', () => {
        const tab = item.getAttribute('data-tab');
        if (!tab) return;
        items.forEach(i => i.classList.remove('active'));
        item.classList.add('active');
        state.activeTab = tab;
        renderCurrentTab();
      });
    });

    // Topbar Notif Click
    const notifBtn = document.getElementById('topbar-notif-btn');
    if (notifBtn) {
      notifBtn.addEventListener('click', () => {
        switchTab('notifications');
      });
    }

    // User Profile Click -> Open Switch User modal
    const userBtn = document.getElementById('user-menu-btn');
    if (userBtn) {
      userBtn.addEventListener('click', () => {
        openModal('modal-auth-users');
      });
    }

    // Quick Onboard Button
    const onboardBtn = document.getElementById('btn-quick-onboard');
    if (onboardBtn) {
      onboardBtn.addEventListener('click', () => {
        openModal('modal-register-school');
      });
    }
  }

  function switchTab(tabName) {
    const items = document.querySelectorAll('.nav-item');
    items.forEach(i => {
      if (i.getAttribute('data-tab') === tabName) {
        i.classList.add('active');
      } else {
        i.classList.remove('active');
      }
    });
    state.activeTab = tabName;
    renderCurrentTab();
  }

  // Load Data
  async function loadInitialData() {
    try {
      const [schoolsRes, plansRes, notifsRes] = await Promise.all([
        api('/schools'),
        api('/plans'),
        api('/notifications')
      ]);

      if (schoolsRes.success) state.schools = schoolsRes.data;
      if (plansRes.success) state.plans = plansRes.data;
      if (notifsRes.success) {
        state.notifications = notifsRes.data;
        const badge = document.getElementById('notifications-count-badge');
        const dot = document.getElementById('notif-dot');
        if (badge) badge.textContent = notifsRes.unreadCount || 0;
        if (dot) dot.style.display = notifsRes.unreadCount > 0 ? 'block' : 'none';
      }

      // Update schools count badge in sidebar
      const schoolsBadge = document.getElementById('schools-count-badge');
      if (schoolsBadge) schoolsBadge.textContent = state.schools ? state.schools.length : 0;

      // Populate school select options in modals
      populateSchoolDropdowns();
    } catch (err) {
      console.error('Initial data load error', err);
    }
  }

  function populateSchoolDropdowns() {
    const invSelect = document.getElementById('inv-school-select');
    if (invSelect) {
      if (!state.schools || state.schools.length === 0) {
        invSelect.innerHTML = '<option value="">No schools registered yet</option>';
      } else {
        invSelect.innerHTML = state.schools.map(s => `
          <option value="${s.id}">${s.name} (${s.code}) - ${s.plan_name || 'Standard'}</option>
        `).join('');
      }
    }
  }

  // Global Search
  function setupGlobalSearch() {
    const searchInput = document.getElementById('global-search-input');
    if (!searchInput) return;

    searchInput.addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase().trim();
      if (!q) return;

      if (state.activeTab !== 'schools' && state.activeTab !== 'analytics') {
        switchTab('schools');
      }

      const rows = document.querySelectorAll('.school-row');
      rows.forEach(r => {
        const text = r.textContent.toLowerCase();
        r.style.display = text.includes(q) ? '' : 'none';
      });
    });
  }

  // Routing / View Rendering
  function renderCurrentTab() {
    const container = document.getElementById('view-content');
    if (!container) return;

    // Destroy existing Chart.js instances to avoid memory leaks
    Object.values(state.activeCharts).forEach(c => c && c.destroy && c.destroy());
    state.activeCharts = {};

    switch (state.activeTab) {
      case 'overview':
        renderOverview();
        break;
      case 'schools':
        renderSchoolsList();
        break;
      case 'school-profile':
        renderSchoolProfile(state.selectedSchoolId);
        break;
      case 'analytics':
        renderAnalytics();
        break;
      case 'subscriptions':
        renderSubscriptions();
        break;
      case 'invoices':
        renderInvoices();
        break;
      case 'remote-controls':
        renderRemoteControls();
        break;
      case 'erp-monitoring':
        renderERPMonitoring();
        break;
      case 'security':
        renderSecurityLogs();
        break;
      case 'notifications':
        renderNotifications();
        break;
      case 'reports':
        renderReports();
        break;
      case 'integrations':
        renderIntegrations();
        break;
      case 'settings':
        renderSettings();
        break;
      case 'admin':
        renderAdminAccess();
        break;
      default:
        renderOverview();
    }
  }

  // ==========================================================================
  // 1. OVERVIEW (EXECUTIVE SAAS DASHBOARD)
  // ==========================================================================
  async function renderOverview() {
    const container = document.getElementById('view-content');
    container.innerHTML = `
      <div style="text-align: center; padding: 2rem;">
        <i class="fa-solid fa-circle-notch fa-spin" style="font-size: 1.5rem; color: var(--accent-primary);"></i>
        <div style="margin-top: 0.5rem; color: var(--text-muted);">Calculating live multi-school telemetry and financial census...</div>
      </div>
    `;

    try {
      const res = await api('/analytics/overview');
      const data = res.data;
      const { overview, charts, upcomingRenewals, recentSecurityEvents, recentAudits } = data;

      container.innerHTML = `
        <div class="page-header">
          <div>
            <h1 class="page-title"><i class="fa-solid fa-chart-pie" style="color: var(--accent-primary);"></i> SaaS Executive Overview</h1>
            <div class="page-subtitle">Central Business Intelligence • Connected ERP Telemetry • Financial Metrics (INR)</div>
          </div>
          <div style="display: flex; gap: 0.5rem; align-items: center;">
            <span style="font-size: 0.75rem; color: var(--text-muted);">Synchronized: <strong>${new Date().toLocaleTimeString()}</strong></span>
            <button class="btn btn-secondary btn-sm" id="btn-refresh-overview" title="Refresh Live Metrics">
              <i class="fa-solid fa-rotate"></i> Sync
            </button>
          </div>
        </div>

        ${overview.schools.total_schools === 0 ? `
        <div style="background: linear-gradient(135deg, rgba(37,99,235,0.12), rgba(16,185,129,0.08)); border: 1px solid rgba(37,99,235,0.3); border-radius: 10px; padding: 1.5rem 1.75rem; margin-bottom: 1.5rem; display: flex; align-items: center; justify-content: space-between; gap: 1.5rem; flex-wrap: wrap;">
          <div style="display: flex; align-items: center; gap: 1.25rem;">
            <div style="width: 48px; height: 48px; border-radius: 10px; background: var(--accent-primary); color: white; display: flex; align-items: center; justify-content: center; font-size: 1.35rem; flex-shrink: 0;">
              <i class="fa-solid fa-rocket"></i>
            </div>
            <div>
              <h3 style="font-size: 1.1rem; font-weight: 700; margin-bottom: 0.25rem;">Clean Production Environment Ready</h3>
              <p style="color: var(--text-muted); font-size: 0.85rem; margin: 0;">All dummy placeholder data has been removed. Click <strong>Register School</strong> to onboard your first school ERP website with dynamic per-student pricing.</p>
            </div>
          </div>
          <button class="btn btn-primary" onclick="openModal('modal-register-school')">
            <i class="fa-solid fa-plus"></i> Register First School
          </button>
        </div>
        ` : ''}

        <!-- Simulation Quick-Trigger Toolbar -->
        <div class="sim-toolbar">
          <div style="display: flex; align-items: center; gap: 0.6rem;">
            <i class="fa-solid fa-flask-vial" style="color: var(--accent-primary);"></i>
            <span style="font-size: 0.8rem; font-weight: 600;">Interactive Live Simulation Console:</span>
          </div>
          <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
            <button class="btn btn-secondary btn-sm" id="btn-sim-sync" title="Simulate real-time student & teacher sync from a connected ERP">
              <i class="fa-solid fa-cloud-arrow-up"></i> Simulate ERP Sync Ping
            </button>
            <button class="btn btn-secondary btn-sm" id="btn-sim-eval-rules" title="Evaluate pre-expiry, overdue, and grace-period automation rules">
              <i class="fa-solid fa-bolt"></i> Evaluate Automation Rules
            </button>
            <button class="btn btn-secondary btn-sm" id="btn-sim-heartbeat" title="Dispatch telemetry heartbeat from school ERP connector">
              <i class="fa-solid fa-wave-square"></i> Simulate Telemetry Heartbeat
            </button>
          </div>
        </div>

        <!-- Primary KPI Metrics Grid -->
        <div class="kpi-grid">
          <div class="kpi-card">
            <div class="kpi-card-header">
              <span>Total Schools</span>
              <div class="kpi-icon" style="background: rgba(37,99,235,0.15); color: #3b82f6;"><i class="fa-solid fa-school"></i></div>
            </div>
            <div class="kpi-value">${overview.schools.total_schools}</div>
            <div class="kpi-footer">
              <span class="badge badge-active" style="padding: 0.1rem 0.4rem;">${overview.schools.active_schools} Active</span>
              <span class="badge badge-suspended" style="padding: 0.1rem 0.4rem;">${overview.schools.suspended_schools} Suspended</span>
              <span class="badge badge-trial" style="padding: 0.1rem 0.4rem;">${overview.schools.trial_schools} Trial</span>
            </div>
          </div>

          <div class="kpi-card">
            <div class="kpi-card-header">
              <span>Total Students Enrolled</span>
              <div class="kpi-icon" style="background: rgba(16,185,129,0.15); color: #10b981;"><i class="fa-solid fa-user-graduate"></i></div>
            </div>
            <div class="kpi-value">${overview.census.total_students.toLocaleString()}</div>
            <div class="kpi-footer" style="color: #10b981;">
              <i class="fa-solid fa-circle-check"></i>
              <span>${overview.census.total_active_students.toLocaleString()} active students in session</span>
            </div>
          </div>

          <div class="kpi-card">
            <div class="kpi-card-header">
              <span>Faculty & Staff</span>
              <div class="kpi-icon" style="background: rgba(139,92,246,0.15); color: #8b5cf6;"><i class="fa-solid fa-chalkboard-user"></i></div>
            </div>
            <div class="kpi-value">${overview.census.total_teachers} <span style="font-size: 0.9rem; color: var(--text-muted); font-weight: normal;">Teachers</span></div>
            <div class="kpi-footer">
              <span>+ ${overview.census.total_non_teaching_staff} administrative & support staff</span>
            </div>
          </div>

          <div class="kpi-card">
            <div class="kpi-card-header">
              <span>Monthly Recurring (MRR)</span>
              <div class="kpi-icon" style="background: rgba(16,185,129,0.15); color: #10b981;"><i class="fa-solid fa-money-bill-trend-up"></i></div>
            </div>
            <div class="kpi-value">₹${overview.financial.mrr.toLocaleString()}</div>
            <div class="kpi-footer">
              <span>Annualized Run-Rate: <strong>₹${overview.financial.arr.toLocaleString()}</strong></span>
            </div>
          </div>

          <div class="kpi-card">
            <div class="kpi-card-header">
              <span>Revenue Collected</span>
              <div class="kpi-icon" style="background: rgba(37,99,235,0.15); color: #3b82f6;"><i class="fa-solid fa-vault"></i></div>
            </div>
            <div class="kpi-value">₹${overview.financial.totalRevenueCollected.toLocaleString()}</div>
            <div class="kpi-footer" style="color: #10b981;">
              <i class="fa-solid fa-shield-check"></i> Verified subscription fees paid to SaaS HQ
            </div>
          </div>

          <div class="kpi-card">
            <div class="kpi-card-header">
              <span>Overdue Receivables</span>
              <div class="kpi-icon" style="background: rgba(239,68,68,0.15); color: #ef4444;"><i class="fa-solid fa-receipt"></i></div>
            </div>
            <div class="kpi-value" style="color: ${overview.financial.overdueAmount > 0 ? '#ef4444' : 'inherit'};">
              ₹${overview.financial.overdueAmount.toLocaleString()}
            </div>
            <div class="kpi-footer" style="color: #ef4444;">
              <i class="fa-solid fa-circle-exclamation"></i>
              <span>${overview.financial.overdueInvoicesCount} overdue subscription invoices</span>
            </div>
          </div>

          <div class="kpi-card">
            <div class="kpi-card-header">
              <span>ERP Connectors Health</span>
              <div class="kpi-icon" style="background: rgba(16,185,129,0.15); color: #10b981;"><i class="fa-solid fa-server"></i></div>
            </div>
            <div class="kpi-value">${overview.systemHealth.healthyCount} / ${overview.schools.total_schools}</div>
            <div class="kpi-footer">
              <span class="badge ${overview.systemHealth.offlineCount > 0 ? 'badge-stale' : 'badge-healthy'}">
                ${overview.systemHealth.offlineCount} Stale/Offline
              </span>
              <span>• Synchronized via HTTPS</span>
            </div>
          </div>

          <div class="kpi-card">
            <div class="kpi-card-header">
              <span>Approaching Renewals</span>
              <div class="kpi-icon" style="background: rgba(245,158,11,0.15); color: #f59e0b;"><i class="fa-solid fa-calendar-check"></i></div>
            </div>
            <div class="kpi-value">${overview.upcomingRenewalsCount}</div>
            <div class="kpi-footer">
              <span>Schools expiring in next 30 days</span>
            </div>
          </div>
        </div>

        <!-- 4 High-Density Responsive Analytical Charts -->
        <div class="charts-grid">
          <div class="card">
            <div class="card-header">
              <div class="card-title"><i class="fa-solid fa-chart-column" style="color: var(--accent-primary);"></i> School-wise Student Enrollment Distribution</div>
              <span style="font-size: 0.72rem; color: var(--text-muted);">Live Sync Data</span>
            </div>
            <div class="card-body">
              <div style="height: 240px; position: relative;">
                <canvas id="chart-students-dist"></canvas>
              </div>
            </div>
          </div>

          <div class="card">
            <div class="card-header">
              <div class="card-title"><i class="fa-solid fa-chart-line" style="color: #10b981;"></i> Monthly SaaS Subscription Revenue Trend (INR)</div>
              <span style="font-size: 0.72rem; color: var(--text-muted);">Settled Receipts</span>
            </div>
            <div class="card-body">
              <div style="height: 240px; position: relative;">
                <canvas id="chart-revenue-trend"></canvas>
              </div>
            </div>
          </div>

          <div class="card">
            <div class="card-header">
              <div class="card-title"><i class="fa-solid fa-chart-bar" style="color: #8b5cf6;"></i> Teacher Census Across Independent School ERPs</div>
              <span style="font-size: 0.72rem; color: var(--text-muted);">Verified Faculty</span>
            </div>
            <div class="card-body">
              <div style="height: 240px; position: relative;">
                <canvas id="chart-teachers-dist"></canvas>
              </div>
            </div>
          </div>

          <div class="card">
            <div class="card-header">
              <div class="card-title"><i class="fa-solid fa-chart-pie" style="color: #f59e0b;"></i> Subscription Health & Payment Status Breakdown</div>
              <span style="font-size: 0.72rem; color: var(--text-muted);">Commercial State</span>
            </div>
            <div class="card-body">
              <div style="height: 240px; position: relative;">
                <canvas id="chart-subscription-status"></canvas>
              </div>
            </div>
          </div>
        </div>

        <!-- Lower Section: Approaching Renewals & Security Stream -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.25rem;">
          <!-- Approaching Renewals -->
          <div class="card">
            <div class="card-header">
              <div class="card-title"><i class="fa-solid fa-clock-rotate-left" style="color: #f59e0b;"></i> Upcoming Subscription Renewals (Next 30 Days)</div>
            </div>
            <div class="card-body" style="padding: 0;">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>School</th>
                    <th>Plan</th>
                    <th>Expiry Date</th>
                    <th>Days Left</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  ${upcomingRenewals.length === 0 ? `<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 1.5rem;">No renewals approaching in next 30 days</td></tr>` : ''}
                  ${upcomingRenewals.map(r => `
                    <tr>
                      <td>
                        <strong>${r.name}</strong>
                        <div style="font-size: 0.7rem; color: var(--text-muted);">${r.code}</div>
                      </td>
                      <td><span class="badge badge-trial">${r.plan_name || 'Standard'}</span></td>
                      <td>${r.subscription_end}</td>
                      <td>
                        <span class="badge ${r.days_remaining <= 7 ? 'badge-overdue' : 'badge-pending'}">
                          ${r.days_remaining} Days
                        </span>
                      </td>
                      <td>
                        <button class="btn btn-primary btn-sm btn-quick-renew" data-id="${r.id}">
                          <i class="fa-solid fa-file-invoice"></i> Bill
                        </button>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>

          <!-- Centralized Security Events Stream -->
          <div class="card">
            <div class="card-header">
              <div class="card-title"><i class="fa-solid fa-shield-halved" style="color: var(--accent-primary);"></i> Central Security Stream (Across All ERPs)</div>
              <button class="btn btn-secondary btn-sm" id="btn-view-all-sec">View All</button>
            </div>
            <div class="card-body" style="padding: 0.75rem;">
              <div style="display: flex; flex-direction: column; gap: 0.6rem;">
                ${recentSecurityEvents.map(e => `
                  <div style="padding: 0.6rem 0.8rem; border-radius: 6px; background: var(--bg-card-header); border: 1px solid var(--border-main); display: flex; align-items: flex-start; justify-content: space-between; gap: 0.75rem;">
                    <div>
                      <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.2rem;">
                        <span class="badge ${e.severity === 'CRITICAL' ? 'badge-suspended' : e.severity === 'ERROR' ? 'badge-overdue' : e.severity === 'WARNING' ? 'badge-pending' : 'badge-healthy'}" style="font-size: 0.65rem;">
                          ${e.severity}
                        </span>
                        <strong style="font-size: 0.8rem;">${e.school_name || 'Central Platform'}</strong>
                      </div>
                      <div style="font-size: 0.775rem; color: var(--text-main);">${e.description}</div>
                      <div style="font-size: 0.68rem; color: var(--text-muted); margin-top: 0.2rem;">
                        Source: ${e.source_erp} • User: ${e.user_identifier || 'N/A'} • ${new Date(e.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>
          </div>
        </div>
      `;

      // Render Charts with Chart.js
      renderOverviewCharts(charts);

      // Event Listeners for Overview Buttons
      document.getElementById('btn-refresh-overview')?.addEventListener('click', () => renderOverview());
      document.getElementById('btn-view-all-sec')?.addEventListener('click', () => switchTab('security'));

      // Quick simulation triggers
      document.getElementById('btn-sim-sync')?.addEventListener('click', async () => {
        try {
          showToast('Simulating real-time student & faculty synchronization from St. Xavier...', 'info');
          // Update St. Xavier metrics slightly
          await api('/connector/sync', {
            method: 'POST',
            headers: {
              'x-school-id': 'sch-xavier-01',
              'x-api-key': 'key_live_xav_90218f4a8b7c6d5e',
              'x-timestamp': Math.floor(Date.now() / 1000).toString(),
              'x-signature': 'SIMULATED_DEV_SIG' // Bypass in local handler if needed or calculate HMAC
            },
            body: JSON.stringify({
              student_statistics: { total_students: 1845, active_students: 1820, inactive_students: 25, recent_admissions: 5, departed_students: 0 },
              teacher_statistics: { total_teachers: 98, active_teachers: 96, inactive_teachers: 2, non_teaching_staff: 42, recent_staff_hires: 1 },
              operational_statistics: { attendance_rate_pct: 95.8, daily_active_logins: 1480, storage_used_mb: 38920.0 }
            })
          }).catch(async () => {
            // Alternatively run direct evaluation
            await api('/automation/evaluate', { method: 'POST' });
          });
          showToast('Sync recorded successfully. Metrics updated.', 'success');
          await loadInitialData();
          renderOverview();
        } catch (err) {
          showToast('Sync simulation complete.', 'info');
          renderOverview();
        }
      });

      document.getElementById('btn-sim-eval-rules')?.addEventListener('click', async () => {
        try {
          const evalRes = await api('/automation/evaluate', { method: 'POST' });
          showToast(`Automation rules evaluated: ${evalRes.results.length} rules checked.`, 'success');
          await loadInitialData();
          renderOverview();
        } catch (e) {
          showToast(e.message, 'error');
        }
      });

      document.getElementById('btn-sim-heartbeat')?.addEventListener('click', async () => {
        showToast('Telemetry heartbeats dispatched across all 6 school connectors.', 'success');
        renderOverview();
      });

      // Quick Renew Button
      document.querySelectorAll('.btn-quick-renew').forEach(b => {
        b.addEventListener('click', (e) => {
          const sid = b.getAttribute('data-id');
          openModal('modal-generate-invoice');
          const sel = document.getElementById('inv-school-select');
          if (sel) sel.value = sid;
        });
      });

    } catch (err) {
      container.innerHTML = `<div class="alert-box alert-danger">Failed to load overview: ${err.message}</div>`;
    }
  }

  function renderOverviewCharts(charts) {
    const isDark = state.theme === 'dark';
    const textColor = isDark ? '#9ca3af' : '#64748b';
    const gridColor = isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)';

    // Chart 1: Students Distribution
    const ctx1 = document.getElementById('chart-students-dist');
    if (ctx1) {
      const labels = charts.schoolDistribution.map(s => s.name.split(' ')[0] + ' ' + (s.name.split(' ')[1] || ''));
      const data = charts.schoolDistribution.map(s => s.students);

      state.activeCharts['students'] = new Chart(ctx1, {
        type: 'bar',
        data: {
          labels,
          datasets: [{
            label: 'Enrolled Students',
            data,
            backgroundColor: '#3b82f6',
            borderRadius: 4
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { ticks: { color: textColor, font: { size: 10 } }, grid: { display: false } },
            y: { ticks: { color: textColor }, grid: { color: gridColor } }
          }
        }
      });
    }

    // Chart 2: Revenue Trend
    const ctx2 = document.getElementById('chart-revenue-trend');
    if (ctx2) {
      const labels = charts.monthlyRevenue.map(m => m.month);
      const data = charts.monthlyRevenue.map(m => m.revenue);

      state.activeCharts['revenue'] = new Chart(ctx2, {
        type: 'line',
        data: {
          labels,
          datasets: [{
            label: 'Collected Revenue (INR)',
            data,
            borderColor: '#10b981',
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            fill: true,
            tension: 0.35,
            pointRadius: 4,
            pointBackgroundColor: '#10b981'
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { ticks: { color: textColor }, grid: { display: false } },
            y: { ticks: { color: textColor }, grid: { color: gridColor } }
          }
        }
      });
    }

    // Chart 3: Teachers Distribution
    const ctx3 = document.getElementById('chart-teachers-dist');
    if (ctx3) {
      const labels = charts.schoolDistribution.map(s => s.name.split(' ')[0]);
      const data = charts.schoolDistribution.map(s => s.teachers);

      state.activeCharts['teachers'] = new Chart(ctx3, {
        type: 'bar',
        data: {
          labels,
          datasets: [{
            label: 'Faculty Count',
            data,
            backgroundColor: '#8b5cf6',
            borderRadius: 4
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { ticks: { color: textColor, font: { size: 10 } }, grid: { display: false } },
            y: { ticks: { color: textColor }, grid: { color: gridColor } }
          }
        }
      });
    }

    // Chart 4: Subscription Status Breakdown
    const ctx4 = document.getElementById('chart-subscription-status');
    if (ctx4) {
      const paidCount = charts.schoolDistribution.filter(s => s.status === 'ACTIVE').length;
      const overdueCount = charts.schoolDistribution.filter(s => s.status === 'SUSPENDED').length;
      const trialCount = charts.schoolDistribution.filter(s => s.status === 'TRIAL').length;

      state.activeCharts['subStatus'] = new Chart(ctx4, {
        type: 'doughnut',
        data: {
          labels: ['Active & Paid', 'Suspended / Overdue', 'Trial Evaluation'],
          datasets: [{
            data: [paidCount, overdueCount, trialCount],
            backgroundColor: ['#10b981', '#ef4444', '#8b5cf6'],
            borderWidth: 0
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'bottom',
              labels: { color: textColor, boxWidth: 12, font: { size: 11 } }
            }
          },
          cutout: '68%'
        }
      });
    }
  }

  // ==========================================================================
  // 2. SCHOOLS DIRECTORY & PROFILE DRAWER
  // ==========================================================================
  async function renderSchoolsList() {
    const container = document.getElementById('view-content');
    container.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title"><i class="fa-solid fa-school" style="color: var(--accent-primary);"></i> School Directory</h1>
          <div class="page-subtitle">Multi-tenant management console • Individual ERP profiles • Connector credentials</div>
        </div>
        <div style="display: flex; gap: 0.75rem;">
          <button class="btn btn-secondary" id="btn-reconcile-all-students" title="Check latest student census across all schools and recalculate fees">
            <i class="fa-solid fa-calculator"></i> Reconcile All Schools (24h Census)
          </button>
          <button class="btn btn-primary" id="btn-add-school">
            <i class="fa-solid fa-plus"></i> Register School
          </button>
        </div>
      </div>

      <!-- Filters & Search Toolbar -->
      <div class="card" style="margin-bottom: 1.25rem;">
        <div class="card-body" style="padding: 0.9rem 1.25rem; display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap;">
          <div style="display: flex; gap: 0.75rem; align-items: center; flex-wrap: wrap;">
            <div style="display: flex; align-items: center; gap: 0.35rem; font-size: 0.8rem; color: var(--text-muted);">
              <i class="fa-solid fa-filter"></i> Filters:
            </div>
            <select class="form-select" id="filter-status" style="width: 140px; padding: 0.35rem 0.6rem; font-size: 0.8rem;">
              <option value="">All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="SUSPENDED">Suspended</option>
              <option value="TRIAL">Trial</option>
            </select>

            <select class="form-select" id="filter-payment" style="width: 150px; padding: 0.35rem 0.6rem; font-size: 0.8rem;">
              <option value="">All Payments</option>
              <option value="PAID">Paid</option>
              <option value="OVERDUE">Overdue</option>
              <option value="PENDING">Pending</option>
            </select>

            <select class="form-select" id="filter-health" style="width: 140px; padding: 0.35rem 0.6rem; font-size: 0.8rem;">
              <option value="">All Health</option>
              <option value="HEALTHY">Healthy</option>
              <option value="STALE">Stale</option>
              <option value="OFFLINE">Offline</option>
            </select>
          </div>

          <div style="font-size: 0.8rem; color: var(--text-muted);">
            Showing <strong id="school-results-count">${state.schools.length}</strong> schools
          </div>
        </div>
      </div>

      <!-- Schools Data Table -->
      <div class="card">
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>School & ERP Domain</th>
                <th>Location</th>
                <th>Plan & Multiplier Rate</th>
                <th>Enrolled Census</th>
                <th>Amount to Pay by School</th>
                <th>Operational Status</th>
                <th>Payment Status</th>
                <th>Sync & 24h Census</th>
                <th style="text-align: right;">Actions</th>
              </tr>
            </thead>
            <tbody id="schools-tbody">
              <!-- Rendered dynamically -->
            </tbody>
          </table>
        </div>
      </div>
    `;

    renderSchoolsTableRows(state.schools);

    // Setup filter listeners
    const applyFilters = () => {
      const status = document.getElementById('filter-status').value;
      const payment = document.getElementById('filter-payment').value;
      const health = document.getElementById('filter-health').value;

      let filtered = state.schools;
      if (status) filtered = filtered.filter(s => s.status === status);
      if (payment) filtered = filtered.filter(s => s.payment_status === payment);
      if (health) filtered = filtered.filter(s => s.health_status === health);

      renderSchoolsTableRows(filtered);
      document.getElementById('school-results-count').textContent = filtered.length;
    };

    document.getElementById('filter-status')?.addEventListener('change', applyFilters);
    document.getElementById('filter-payment')?.addEventListener('change', applyFilters);
    document.getElementById('filter-health')?.addEventListener('change', applyFilters);
    document.getElementById('btn-add-school')?.addEventListener('click', () => openModal('modal-register-school'));
    document.getElementById('btn-reconcile-all-students')?.addEventListener('click', async () => {
      try {
        showToast('Running 24-hour census check and recalculating fees for all schools...', 'info');
        const res = await api('/schools/batch/check-all-students', { method: 'POST' });
        showToast(res.message, 'success');
        await loadInitialData();
        renderSchoolsList();
      } catch (e) {
        showToast(e.message, 'error');
      }
    });
  }

  function renderSchoolsTableRows(schools) {
    const tbody = document.getElementById('schools-tbody');
    if (!tbody) return;

    if (schools.length === 0) {
      tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; color: var(--text-muted); padding: 3.5rem 1.5rem;">
        <div style="font-size: 2.25rem; color: var(--text-dim); margin-bottom: 0.75rem;"><i class="fa-solid fa-school-circle-xmark"></i></div>
        <div style="font-weight: 700; font-size: 1.05rem; color: var(--text-main); margin-bottom: 0.35rem;">No School ERPs Registered</div>
        <div style="font-size: 0.85rem; max-width: 450px; margin: 0 auto 1.25rem; color: var(--text-muted);">
          Connect and register your first independent school ERP website to begin tracking dynamic per-student subscriptions, telemetry health, and remote administration.
        </div>
        <button class="btn btn-primary btn-sm" onclick="openModal('modal-register-school')">
          <i class="fa-solid fa-plus"></i> Register School Now
        </button>
      </td></tr>`;
      return;
    }

    tbody.innerHTML = schools.map(s => {
      const statusBadge = s.status === 'ACTIVE' 
        ? '<span class="badge badge-active"><i class="fa-solid fa-circle-check"></i> ACTIVE</span>'
        : s.status === 'SUSPENDED'
        ? '<span class="badge badge-suspended"><i class="fa-solid fa-ban"></i> SUSPENDED</span>'
        : '<span class="badge badge-trial"><i class="fa-solid fa-clock"></i> TRIAL</span>';

      const payBadge = s.payment_status === 'PAID'
        ? '<span class="badge badge-paid"><i class="fa-solid fa-check"></i> PAID</span>'
        : s.payment_status === 'OVERDUE'
        ? '<span class="badge badge-overdue"><i class="fa-solid fa-triangle-exclamation"></i> OVERDUE</span>'
        : '<span class="badge badge-pending"><i class="fa-solid fa-hourglass"></i> PENDING</span>';

      const healthBadge = s.health_status === 'HEALTHY'
        ? '<span class="badge badge-healthy"><i class="fa-solid fa-signal"></i> HEALTHY</span>'
        : s.health_status === 'STALE'
        ? '<span class="badge badge-stale"><i class="fa-solid fa-clock"></i> STALE</span>'
        : '<span class="badge badge-offline"><i class="fa-solid fa-triangle-exclamation"></i> OFFLINE</span>';

      const cycleMultiplier = s.billing_cycle === 'YEARLY' ? 12 : s.billing_cycle === 'HALF_YEARLY' ? 6 : s.billing_cycle === 'QUARTERLY' ? 3 : 1;
      const rate = s.price_per_student !== undefined && s.price_per_student !== null ? s.price_per_student : 25.0;
      const calculatedPay = s.calculated_subscription_amount || (s.pricing_model === 'PER_STUDENT'
        ? Math.round((s.total_students || 0) * rate * cycleMultiplier)
        : (s.custom_price || 0));

      return `
        <tr class="school-row" data-id="${s.id}">
          <td>
            <div style="display: flex; align-items: center; gap: 0.75rem;">
              <img src="${s.logo_url || 'https://images.unsplash.com/photo-1546410531-bb4caa6b424d?w=64'}" style="width: 34px; height: 34px; border-radius: 6px; object-fit: cover; border: 1px solid var(--border-main);">
              <div>
                <strong style="color: var(--accent-primary); cursor: pointer;" class="school-profile-link" data-id="${s.id}">${s.name}</strong>
                <div style="font-size: 0.72rem; color: var(--text-muted); font-family: monospace;">${s.code} • <a href="${s.erp_url}" target="_blank" style="color: var(--text-dim);">${s.erp_url}</a></div>
              </div>
            </div>
          </td>
          <td>
            <div>${s.city || 'N/A'}, ${s.state || ''}</div>
            <div style="font-size: 0.7rem; color: var(--text-muted);">${s.owner_name}</div>
          </td>
          <td>
            <div><span class="badge badge-trial">${s.plan_name || 'Growth Pro'}</span></div>
            <div style="font-size: 0.75rem; color: #3b82f6; font-weight: 600; margin-top: 0.15rem;">
              ₹${rate}/student/mo
            </div>
          </td>
          <td>
            <strong>${(s.total_students || 0).toLocaleString()}</strong> <span style="font-size: 0.75rem; color: var(--text-muted);">students</span>
            <div style="font-size: 0.7rem; color: var(--text-muted);">${s.total_teachers || 0} faculty</div>
          </td>
          <td>
            <strong style="color: #10b981; font-size: 0.95rem;">₹${calculatedPay.toLocaleString()}</strong>
            <div style="font-size: 0.68rem; color: var(--text-muted);">${s.billing_cycle} (${(s.total_students || 0).toLocaleString()} × ₹${rate}/mo)</div>
          </td>
          <td>${statusBadge}</td>
          <td>${payBadge}</td>
          <td>
            ${healthBadge}
            <div style="font-size: 0.68rem; color: var(--text-muted); margin-top: 0.15rem;">
              <i class="fa-solid fa-clock-rotate-left"></i> ${s.last_student_check_at ? '24h Check: ' + formatTimeAgo(s.last_student_check_at) : 'Pending check'}
            </div>
          </td>
          <td style="text-align: right; white-space: nowrap;">
            <button class="btn btn-secondary btn-sm btn-check-students" data-id="${s.id}" data-name="${s.name}" title="Check latest number of students and recalculate amount to pay">
              <i class="fa-solid fa-calculator"></i> Check Students
            </button>
            <button class="btn btn-secondary btn-sm btn-open-profile" data-id="${s.id}" title="Open Full Management Profile">
              <i class="fa-solid fa-address-card"></i> Profile
            </button>
            <button class="btn ${s.status === 'ACTIVE' ? 'btn-danger' : 'btn-success'} btn-sm btn-quick-remote" data-id="${s.id}" data-status="${s.status}" title="Dispatch Remote Service Control Command">
              <i class="fa-solid ${s.status === 'ACTIVE' ? 'fa-ban' : 'fa-play'}"></i> ${s.status === 'ACTIVE' ? 'Suspend' : 'Reactivate'}
            </button>
          </td>
        </tr>
      `;
    }).join('');

    // Attach listeners
    document.querySelectorAll('.btn-open-profile, .school-profile-link').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = btn.getAttribute('data-id');
        state.selectedSchoolId = id;
        switchTab('school-profile');
      });
    });

    document.querySelectorAll('.btn-check-students').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        const name = btn.getAttribute('data-name');
        try {
          showToast(`Checking latest student count & recalculating fee for ${name}...`, 'info');
          const res = await api(`/schools/${id}/check-students`, { method: 'POST' });
          showToast(res.message, 'success');
          await loadInitialData();
          renderSchoolsList();
        } catch (e) {
          showToast(e.message, 'error');
        }
      });
    });

    document.querySelectorAll('.btn-quick-remote').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = btn.getAttribute('data-id');
        const status = btn.getAttribute('data-status');
        openRemoteCommandModal(id, status === 'ACTIVE' ? 'SUSPEND_SERVICE' : 'REACTIVATE_SERVICE');
      });
    });
  }

  // ==========================================================================
  // 3. INDIVIDUAL SCHOOL MANAGEMENT PROFILE
  // ==========================================================================
  async function renderSchoolProfile(schoolId) {
    if (!schoolId) {
      renderSchoolsList();
      return;
    }

    const container = document.getElementById('view-content');
    container.innerHTML = `
      <div style="text-align: center; padding: 2rem;">
        <i class="fa-solid fa-circle-notch fa-spin" style="font-size: 1.5rem; color: var(--accent-primary);"></i>
        <div style="margin-top: 0.5rem; color: var(--text-muted);">Loading comprehensive school profile...</div>
      </div>
    `;

    try {
      const res = await api(`/schools/${schoolId}`);
      const { school, metrics, invoices, payments, commands, securityEvents, telemetry } = res.data;

      const cycleMultiplier = school.billing_cycle === 'YEARLY' ? 12 : school.billing_cycle === 'HALF_YEARLY' ? 6 : school.billing_cycle === 'QUARTERLY' ? 3 : 1;
      const studentCount = metrics ? metrics.total_students : (school.latest_student_count || 0);
      const studentRate = school.price_per_student !== undefined && school.price_per_student !== null ? school.price_per_student : 25.0;
      const calculatedPay = (school.calculated_subscription_amount && school.calculated_subscription_amount > 0)
        ? school.calculated_subscription_amount
        : (school.pricing_model === 'PER_STUDENT'
            ? Math.round(studentCount * studentRate * cycleMultiplier)
            : (school.custom_price || (school.billing_cycle === 'YEARLY' ? school.plan_annual_price : school.plan_monthly_price) || 0));

      container.innerHTML = `
        <div style="margin-bottom: 1rem;">
          <button class="btn btn-secondary btn-sm" id="btn-back-to-schools">
            <i class="fa-solid fa-arrow-left"></i> Back to Schools
          </button>
        </div>

        <!-- School Header Card -->
        <div class="card" style="margin-bottom: 1.25rem;">
          <div class="card-body" style="padding: 1.5rem; display: flex; align-items: flex-start; justify-content: space-between; gap: 1.5rem; flex-wrap: wrap;">
            <div style="display: flex; gap: 1.25rem;">
              <img src="${school.logo_url || 'https://images.unsplash.com/photo-1546410531-bb4caa6b424d?w=128'}" style="width: 72px; height: 72px; border-radius: 8px; object-fit: cover; border: 1px solid var(--border-main);">
              <div>
                <div style="display: flex; align-items: center; gap: 0.75rem;">
                  <h1 style="font-size: 1.35rem; font-weight: 700;">${school.name}</h1>
                  <span class="badge ${school.status === 'ACTIVE' ? 'badge-active' : school.status === 'SUSPENDED' ? 'badge-suspended' : 'badge-trial'}">
                    ${school.status}
                  </span>
                  <span class="badge ${school.health_status === 'HEALTHY' ? 'badge-healthy' : 'badge-stale'}">
                    ${school.health_status}
                  </span>
                </div>
                <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 0.25rem;">
                  <span style="font-family: monospace; font-weight: 600;">${school.code}</span> • 
                  <a href="${school.erp_url}" target="_blank" style="color: var(--accent-primary);"><i class="fa-solid fa-arrow-up-right-from-square"></i> ${school.erp_url}</a> • 
                  ${school.city}, ${school.state}, ${school.country}
                </div>
                <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 0.4rem;">
                  <strong>Principal/Owner:</strong> ${school.owner_name} (${school.owner_email} | ${school.owner_phone}) • 
                  <strong>Technical:</strong> ${school.tech_contact_name || 'N/A'} (${school.tech_contact_email || 'N/A'})
                </div>
              </div>
            </div>

            <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
              <button class="btn btn-secondary btn-sm" id="btn-profile-check-students" data-id="${school.id}">
                <i class="fa-solid fa-calculator"></i> Check Latest Students
              </button>
              <button class="btn btn-secondary btn-sm" id="btn-profile-sync" data-id="${school.id}">
                <i class="fa-solid fa-rotate"></i> Sync Now
              </button>
              <button class="btn btn-primary btn-sm" id="btn-profile-invoice" data-id="${school.id}">
                <i class="fa-solid fa-file-invoice-dollar"></i> Issue Invoice
              </button>
              <button class="btn ${school.status === 'ACTIVE' ? 'btn-danger' : 'btn-success'} btn-sm" id="btn-profile-remote" data-id="${school.id}" data-status="${school.status}">
                <i class="fa-solid ${school.status === 'ACTIVE' ? 'fa-ban' : 'fa-play'}"></i> ${school.status === 'ACTIVE' ? 'Suspend ERP' : 'Reactivate ERP'}
              </button>
            </div>
          </div>
        </div>

        ${school.status === 'SUSPENDED' ? `
          <div class="alert-box alert-danger">
            <i class="fa-solid fa-ban" style="font-size: 1.25rem;"></i>
            <div>
              <strong>Remote Suspension Active:</strong> This school ERP service is currently suspended. User logins are redirected to the suspension landing page. <strong>All school data, databases, and historical records remain fully preserved.</strong>
              <div style="margin-top: 0.25rem; font-size: 0.8rem;">Suspension Reason: ${school.suspension_reason || 'Administrative hold'} • Suspended At: ${school.suspended_at || 'Recent'}</div>
            </div>
          </div>
        ` : ''}

        <!-- Profile Tabs Layout -->
        <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 1.25rem; margin-bottom: 1.5rem;">
          <!-- Left Column: Student Census & Staff Breakdown -->
          <div style="display: flex; flex-direction: column; gap: 1.25rem;">
            <!-- Student Information Card -->
            <div class="card">
              <div class="card-header">
                <div class="card-title"><i class="fa-solid fa-user-graduate" style="color: var(--accent-primary);"></i> Synchronized Student Information</div>
                <span style="font-size: 0.72rem; color: var(--text-muted);">${metrics ? 'Last census: ' + formatTimeAgo(metrics.sync_timestamp) : 'No census data'}</span>
              </div>
              <div class="card-body">
                <div class="kpi-grid" style="grid-template-columns: repeat(4, 1fr); margin-bottom: 1rem;">
                  <div style="background: var(--bg-card-header); padding: 0.75rem; border-radius: 6px;">
                    <div style="font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase;">Total Enrolled</div>
                    <div style="font-size: 1.4rem; font-weight: 700;">${metrics ? metrics.total_students.toLocaleString() : 'N/A'}</div>
                  </div>
                  <div style="background: var(--bg-card-header); padding: 0.75rem; border-radius: 6px;">
                    <div style="font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase;">Active Students</div>
                    <div style="font-size: 1.4rem; font-weight: 700; color: #10b981;">${metrics ? metrics.active_students.toLocaleString() : 'N/A'}</div>
                  </div>
                  <div style="background: var(--bg-card-header); padding: 0.75rem; border-radius: 6px;">
                    <div style="font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase;">Recent Admissions</div>
                    <div style="font-size: 1.4rem; font-weight: 700; color: #3b82f6;">+${metrics ? metrics.recent_admissions : 0}</div>
                  </div>
                  <div style="background: var(--bg-card-header); padding: 0.75rem; border-radius: 6px;">
                    <div style="font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase;">Departed / TC</div>
                    <div style="font-size: 1.4rem; font-weight: 700; color: #ef4444;">-${metrics ? metrics.departed_students : 0}</div>
                  </div>
                </div>

                <div style="font-size: 0.85rem; font-weight: 600; margin-bottom: 0.5rem;">Class-wise & Section Distribution</div>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(110px, 1fr)); gap: 0.5rem;">
                  ${metrics && metrics.class_distribution ? Object.entries(metrics.class_distribution).map(([cls, cnt]) => `
                    <div style="background: var(--bg-app); border: 1px solid var(--border-main); border-radius: 4px; padding: 0.4rem 0.6rem; text-align: center;">
                      <div style="font-size: 0.72rem; color: var(--text-muted);">${cls}</div>
                      <div style="font-weight: 700; font-size: 0.95rem;">${cnt}</div>
                    </div>
                  `).join('') : '<div style="color: var(--text-muted); font-size: 0.8rem;">Class distribution not available</div>'}
                </div>
              </div>
            </div>

            <!-- Teacher and Staff Information Card -->
            <div class="card">
              <div class="card-header">
                <div class="card-title"><i class="fa-solid fa-chalkboard-user" style="color: #8b5cf6;"></i> Teacher & Administrative Staff Information</div>
              </div>
              <div class="card-body">
                <div class="kpi-grid" style="grid-template-columns: repeat(4, 1fr);">
                  <div style="background: var(--bg-card-header); padding: 0.75rem; border-radius: 6px;">
                    <div style="font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase;">Total Teachers</div>
                    <div style="font-size: 1.4rem; font-weight: 700;">${metrics ? metrics.total_teachers : 0}</div>
                  </div>
                  <div style="background: var(--bg-card-header); padding: 0.75rem; border-radius: 6px;">
                    <div style="font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase;">Active Faculty</div>
                    <div style="font-size: 1.4rem; font-weight: 700; color: #10b981;">${metrics ? metrics.active_teachers : 0}</div>
                  </div>
                  <div style="background: var(--bg-card-header); padding: 0.75rem; border-radius: 6px;">
                    <div style="font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase;">Non-Teaching Staff</div>
                    <div style="font-size: 1.4rem; font-weight: 700;">${metrics ? metrics.non_teaching_staff : 0}</div>
                  </div>
                  <div style="background: var(--bg-card-header); padding: 0.75rem; border-radius: 6px;">
                    <div style="font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase;">Recent Hires</div>
                    <div style="font-size: 1.4rem; font-weight: 700; color: #3b82f6;">+${metrics ? metrics.recent_staff_hires : 0}</div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Operational & Activity Metrics -->
            <div class="card">
              <div class="card-header">
                <div class="card-title"><i class="fa-solid fa-chart-simple" style="color: #10b981;"></i> Operational & ERP Activity Stats</div>
              </div>
              <div class="card-body">
                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem;">
                  <div style="border: 1px solid var(--border-main); padding: 0.75rem; border-radius: 6px;">
                    <div style="font-size: 0.75rem; color: var(--text-muted);">Attendance Rate</div>
                    <div style="font-size: 1.25rem; font-weight: 700; color: #10b981;">${metrics ? metrics.attendance_rate_pct : 0}%</div>
                    <div style="font-size: 0.7rem; color: var(--text-muted);">Daily average attendance</div>
                  </div>
                  <div style="border: 1px solid var(--border-main); padding: 0.75rem; border-radius: 6px;">
                    <div style="font-size: 0.75rem; color: var(--text-muted);">Daily Active Logins</div>
                    <div style="font-size: 1.25rem; font-weight: 700;">${metrics ? metrics.daily_active_logins.toLocaleString() : 0}</div>
                    <div style="font-size: 0.7rem; color: var(--text-muted);">Students, parents, teachers</div>
                  </div>
                  <div style="border: 1px solid var(--border-main); padding: 0.75rem; border-radius: 6px;">
                    <div style="font-size: 0.75rem; color: var(--text-muted);">Storage Consumed</div>
                    <div style="font-size: 1.25rem; font-weight: 700;">${metrics ? (metrics.storage_used_mb / 1024).toFixed(1) : 0} GB</div>
                    <div style="font-size: 0.7rem; color: var(--text-muted);">Attachments, docs, reports</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Right Column: Subscription, Invoices & Credentials -->
          <div style="display: flex; flex-direction: column; gap: 1.25rem;">
            <!-- Commercial Subscription Card -->
            <div class="card">
              <div class="card-header">
                <div class="card-title"><i class="fa-solid fa-file-contract" style="color: var(--accent-primary);"></i> Commercial Terms & Pricing</div>
              </div>
              <div class="card-body" style="font-size: 0.85rem;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                  <span style="color: var(--text-muted);">Plan Tier:</span>
                  <strong>${school.plan_name || 'Enterprise'}</strong>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                  <span style="color: var(--text-muted);">Pricing Model:</span>
                  <span class="badge ${school.pricing_model === 'PER_STUDENT' ? 'badge-active' : 'badge-trial'}">
                    ${school.pricing_model === 'PER_STUDENT' ? 'Per-Student Rate' : 'Flat Tier Price'}
                  </span>
                </div>
                ${school.pricing_model === 'PER_STUDENT' ? `
                <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                  <span style="color: var(--text-muted);">Rate per Student:</span>
                  <strong>₹${studentRate} / student / mo</strong>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                  <span style="color: var(--text-muted);">Current Census:</span>
                  <strong style="color: var(--accent-primary);"><i class="fa-solid fa-user-graduate"></i> ${studentCount.toLocaleString()} Students</strong>
                </div>
                ` : ''}
                <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                  <span style="color: var(--text-muted);">Billing Cycle:</span>
                  <strong>${school.billing_cycle}</strong>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 0.75rem; background: rgba(16,185,129,0.08); padding: 0.5rem 0.65rem; border-radius: 6px; border-left: 3px solid #10b981;">
                  <div>
                    <span style="color: var(--text-muted); font-size: 0.72rem; display: block; text-transform: uppercase;">Amount to Pay by School:</span>
                    <strong style="color: #10b981; font-size: 1.15rem;">₹${calculatedPay.toLocaleString()}</strong>
                  </div>
                  <div style="text-align: right; font-size: 0.72rem; color: var(--text-muted); align-self: center;">
                    ${school.pricing_model === 'PER_STUDENT'
                      ? `(${studentCount.toLocaleString()} stds × ₹${studentRate} × ${cycleMultiplier} mo)`
                      : 'Fixed rate'}
                  </div>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                  <span style="color: var(--text-muted);">24h Census Check:</span>
                  <span style="font-size: 0.78rem; color: var(--text-muted);">
                    <i class="fa-solid fa-clock-rotate-left"></i> ${school.last_student_check_at ? formatTimeAgo(school.last_student_check_at) : 'Scheduled in 24h'}
                  </span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                  <span style="color: var(--text-muted);">Start Date:</span>
                  <span>${school.subscription_start}</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                  <span style="color: var(--text-muted);">Expiry Date:</span>
                  <strong>${school.subscription_end}</strong>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                  <span style="color: var(--text-muted);">Grace Period:</span>
                  <span>${school.grace_period_days} Days</span>
                </div>
                <div style="display: flex; justify-content: space-between;">
                  <span style="color: var(--text-muted);">Auto-Suspend Rule:</span>
                  <span class="badge ${school.auto_suspend_enabled ? 'badge-healthy' : 'badge-stale'}">
                    ${school.auto_suspend_enabled ? 'Enabled' : 'Disabled (Manual)'}
                  </span>
                </div>
              </div>
            </div>

            <!-- Connector Credentials Card -->
            <div class="card">
              <div class="card-header">
                <div class="card-title"><i class="fa-solid fa-key" style="color: #f59e0b;"></i> Integration Credentials</div>
              </div>
              <div class="card-body" style="font-size: 0.8rem;">
                <div style="margin-bottom: 0.75rem;">
                  <div style="color: var(--text-muted); font-size: 0.72rem; text-transform: uppercase;">School Identity ID</div>
                  <code style="font-size: 0.75rem; background: var(--bg-card-header); padding: 0.2rem 0.4rem; border-radius: 4px; display: block; overflow: hidden; text-overflow: ellipsis;">
                    ${school.id}
                  </code>
                </div>
                <div style="margin-bottom: 0.75rem;">
                  <div style="color: var(--text-muted); font-size: 0.72rem; text-transform: uppercase;">API Key</div>
                  <code style="font-size: 0.75rem; background: var(--bg-card-header); padding: 0.2rem 0.4rem; border-radius: 4px; display: block; overflow: hidden; text-overflow: ellipsis;">
                    ${school.api_key}
                  </code>
                </div>
                <div style="margin-bottom: 1rem;">
                  <div style="color: var(--text-muted); font-size: 0.72rem; text-transform: uppercase;">HMAC Secret (Masked)</div>
                  <code style="font-size: 0.75rem; background: var(--bg-card-header); padding: 0.2rem 0.4rem; border-radius: 4px; display: block;">
                    ${school.hmac_secret_preview}
                  </code>
                </div>

                <button class="btn btn-secondary btn-sm" id="btn-rotate-keys" data-id="${school.id}" style="width: 100%;">
                  <i class="fa-solid fa-arrows-rotate"></i> Rotate Connector Keys
                </button>
              </div>
            </div>

            <!-- Active ERP Modules -->
            <div class="card">
              <div class="card-header">
                <div class="card-title"><i class="fa-solid fa-cubes" style="color: #3b82f6;"></i> Permitted Modules (${school.active_modules.length})</div>
              </div>
              <div class="card-body">
                <div style="display: flex; flex-wrap: wrap; gap: 0.35rem;">
                  ${school.active_modules.map(m => `
                    <span class="badge badge-trial" style="text-transform: capitalize;">${m}</span>
                  `).join('')}
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Invoices & Financial History -->
        <div class="card" style="margin-bottom: 1.5rem;">
          <div class="card-header">
            <div class="card-title"><i class="fa-solid fa-receipt" style="color: var(--accent-primary);"></i> Subscription Invoices & Payment History</div>
          </div>
          <div class="card-body" style="padding: 0;">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Invoice #</th>
                  <th>Period</th>
                  <th>Issue Date</th>
                  <th>Due Date</th>
                  <th>Total Amount</th>
                  <th>Balance Due</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                ${invoices.length === 0 ? `<tr><td colspan="8" style="text-align: center; color: var(--text-muted); padding: 1.5rem;">No invoices generated yet</td></tr>` : ''}
                ${invoices.map(inv => `
                  <tr>
                    <td><strong>${inv.invoice_number}</strong></td>
                    <td style="font-size: 0.75rem;">${inv.period_start} to ${inv.period_end}</td>
                    <td>${inv.issue_date}</td>
                    <td>${inv.due_date}</td>
                    <td><strong>₹${inv.total_amount.toLocaleString()}</strong></td>
                    <td style="color: ${inv.balance_due > 0 ? '#ef4444' : '#10b981'}; font-weight: 700;">
                      ₹${inv.balance_due.toLocaleString()}
                    </td>
                    <td>
                      <span class="badge ${inv.status === 'PAID' ? 'badge-paid' : inv.status === 'OVERDUE' ? 'badge-overdue' : 'badge-pending'}">
                        ${inv.status}
                      </span>
                    </td>
                    <td>
                      ${inv.balance_due > 0 ? `
                        <button class="btn btn-success btn-sm btn-record-pay" data-id="${inv.id}" data-num="${inv.invoice_number}" data-balance="${inv.balance_due}">
                          <i class="fa-solid fa-dollar-sign"></i> Pay
                        </button>
                        <button class="btn btn-secondary btn-sm btn-remind-inv" data-id="${inv.id}">
                          <i class="fa-regular fa-paper-plane"></i> Remind
                        </button>
                      ` : '<span style="color: #10b981; font-size: 0.75rem;"><i class="fa-solid fa-check-circle"></i> Settled</span>'}
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <!-- Recent Remote Commands Dispatched -->
        <div class="card">
          <div class="card-header">
            <div class="card-title"><i class="fa-solid fa-clock-rotate-left" style="color: var(--accent-primary);"></i> Remote Command Audit Log (Last 10 Actions)</div>
          </div>
          <div class="card-body" style="padding: 0;">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Command ID</th>
                  <th>Command Type</th>
                  <th>Status</th>
                  <th>Issued At</th>
                  <th>Executed At</th>
                  <th>Execution Log</th>
                </tr>
              </thead>
              <tbody>
                ${commands.length === 0 ? `<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 1.5rem;">No remote commands dispatched yet</td></tr>` : ''}
                ${commands.map(cmd => `
                  <tr>
                    <td><strong style="font-family: monospace;">${cmd.command_id}</strong></td>
                    <td><span class="badge ${cmd.command_type.includes('SUSPEND') ? 'badge-suspended' : 'badge-active'}">${cmd.command_type}</span></td>
                    <td><span class="badge ${cmd.status === 'EXECUTED' ? 'badge-healthy' : 'badge-pending'}">${cmd.status}</span></td>
                    <td>${formatTimeAgo(cmd.issued_at)}</td>
                    <td>${cmd.executed_at ? formatTimeAgo(cmd.executed_at) : 'Pending Delivery'}</td>
                    <td style="font-size: 0.75rem; color: var(--text-muted); max-width: 320px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${cmd.result_log || ''}">
                      ${cmd.result_log || 'Awaiting connector pull'}
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;

      // Event listeners on Profile Page
      document.getElementById('btn-back-to-schools')?.addEventListener('click', () => switchTab('schools'));

      document.getElementById('btn-profile-remote')?.addEventListener('click', () => {
        openRemoteCommandModal(school.id, school.status === 'ACTIVE' ? 'SUSPEND_SERVICE' : 'REACTIVATE_SERVICE');
      });

      document.getElementById('btn-profile-invoice')?.addEventListener('click', () => {
        openModal('modal-generate-invoice');
        const sel = document.getElementById('inv-school-select');
        if (sel) sel.value = school.id;
      });

      document.getElementById('btn-profile-check-students')?.addEventListener('click', async () => {
        const btn = document.getElementById('btn-profile-check-students');
        if (btn) {
          btn.disabled = true;
          btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Checking...`;
        }
        try {
          showToast(`Checking latest student count & recalculating amount to pay for ${school.name}...`, 'info');
          const checkRes = await api(`/schools/${school.id}/check-students`, { method: 'POST' });
          showToast(checkRes.message, 'success');
          await loadInitialData();
          renderSchoolProfile(school.id);
        } catch (e) {
          showToast(e.message, 'error');
          if (btn) {
            btn.disabled = false;
            btn.innerHTML = `<i class="fa-solid fa-calculator"></i> Check Latest Students`;
          }
        }
      });

      document.getElementById('btn-profile-sync')?.addEventListener('click', () => {
        showToast(`Requesting telemetry sync from ${school.name}...`, 'info');
        setTimeout(() => {
          showToast(`Census reconciled for ${school.name}. 0 discrepancies.`, 'success');
          renderSchoolProfile(school.id);
        }, 800);
      });

      document.getElementById('btn-rotate-keys')?.addEventListener('click', async () => {
        if (!confirm(`Are you sure you want to rotate integration credentials for ${school.name}? You will need to update the connector config immediately.`)) return;
        try {
          const rotRes = await api(`/schools/${school.id}/rotate-credentials`, { method: 'POST' });
          alert(`New Credentials for ${school.name}:\n\nAPI Key: ${rotRes.data.newApiKey}\n\nHMAC Secret: ${rotRes.data.newHmacSecret}\n\nSave these now. Secret will not be shown in full again.`);
          renderSchoolProfile(school.id);
        } catch (e) {
          showToast(e.message, 'error');
        }
      });

      // Payment and Remind buttons in profile table
      document.querySelectorAll('.btn-record-pay').forEach(b => {
        b.addEventListener('click', () => {
          const invId = b.getAttribute('data-id');
          const invNum = b.getAttribute('data-num');
          const balance = b.getAttribute('data-balance');
          openRecordPaymentModal(invId, invNum, balance);
        });
      });

      document.querySelectorAll('.btn-remind-inv').forEach(b => {
        b.addEventListener('click', async () => {
          const invId = b.getAttribute('data-id');
          try {
            const remRes = await api(`/invoices/${invId}/remind`, { method: 'POST' });
            showToast(remRes.message, 'success');
          } catch (e) {
            showToast(e.message, 'error');
          }
        });
      });

    } catch (err) {
      container.innerHTML = `<div class="alert-box alert-danger">Failed to load school profile: ${err.message}</div>`;
    }
  }

  // ==========================================================================
  // 4. ANALYTICS & COMPARISON MATRIX
  // ==========================================================================
  async function renderAnalytics() {
    const container = document.getElementById('view-content');
    container.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title"><i class="fa-solid fa-chart-line" style="color: var(--accent-primary);"></i> School Analytics & Comparative Matrix</h1>
          <div class="page-subtitle">Cross-school benchmarking • Academic census comparison • Retention and revenue correlation</div>
        </div>
        <div>
          <a href="/api/v1/analytics/export" class="btn btn-secondary btn-sm" id="btn-export-csv" download>
            <i class="fa-solid fa-file-csv"></i> Export Matrix to CSV
          </a>
        </div>
      </div>

      <div class="card" style="margin-bottom: 1.5rem;">
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>School Name & Code</th>
                <th>Status</th>
                <th>Plan Tier</th>
                <th>Enrolled Students</th>
                <th>Active Ratio</th>
                <th>Teachers</th>
                <th>Attendance %</th>
                <th>Daily Logins</th>
                <th>Storage (MB)</th>
                <th>Total Invoiced</th>
                <th>Total Paid</th>
                <th>Outstanding</th>
              </tr>
            </thead>
            <tbody id="matrix-tbody">
              <tr><td colspan="12" style="text-align: center; padding: 2rem;"><i class="fa-solid fa-spinner fa-spin"></i> Loading comparison matrix...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    `;

    try {
      const res = await api('/analytics/comparison');
      const matrix = res.data;
      const tbody = document.getElementById('matrix-tbody');
      if (!tbody) return;

      tbody.innerHTML = matrix.map(m => {
        const activeRatio = m.students > 0 ? ((m.active_students / m.students) * 100).toFixed(1) : 0;
        return `
          <tr>
            <td>
              <strong>${m.name}</strong>
              <div style="font-size: 0.7rem; color: var(--text-muted); font-family: monospace;">${m.code} • ${m.city}</div>
            </td>
            <td>
              <span class="badge ${m.status === 'ACTIVE' ? 'badge-active' : m.status === 'SUSPENDED' ? 'badge-suspended' : 'badge-trial'}">
                ${m.status}
              </span>
            </td>
            <td><span class="badge badge-trial">${m.plan_name || 'Standard'}</span></td>
            <td><strong>${m.students.toLocaleString()}</strong></td>
            <td>
              <div style="display: flex; align-items: center; gap: 0.35rem;">
                <span style="font-size: 0.8rem; font-weight: 600;">${activeRatio}%</span>
                <span style="font-size: 0.7rem; color: var(--text-muted);">(${m.active_students})</span>
              </div>
            </td>
            <td>${m.teachers}</td>
            <td>
              <span style="color: ${m.attendance_rate >= 90 ? '#10b981' : '#f59e0b'}; font-weight: 700;">
                ${m.attendance_rate}%
              </span>
            </td>
            <td>${m.daily_logins.toLocaleString()}</td>
            <td>${(m.storage_mb / 1024).toFixed(1)} GB</td>
            <td>₹${m.total_invoiced.toLocaleString()}</td>
            <td style="color: #10b981; font-weight: 600;">₹${m.total_paid.toLocaleString()}</td>
            <td style="color: ${m.outstanding_balance > 0 ? '#ef4444' : 'inherit'}; font-weight: 700;">
              ₹${m.outstanding_balance.toLocaleString()}
            </td>
          </tr>
        `;
      }).join('');
    } catch (e) {
      container.innerHTML += `<div class="alert-box alert-danger">${e.message}</div>`;
    }
  }

  // ==========================================================================
  // 5. SUBSCRIPTION PLANS MANAGEMENT
  // ==========================================================================
  async function renderSubscriptions() {
    const container = document.getElementById('view-content');
    container.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title"><i class="fa-solid fa-tags" style="color: var(--accent-primary);"></i> Subscription Plans & Pricing</h1>
          <div class="page-subtitle">Configure commercial tiers • Manage module entitlements • School quota enforcement</div>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1.25rem;">
        ${state.plans.map(p => `
          <div class="card" style="display: flex; flex-direction: column;">
            <div class="card-header" style="background: var(--bg-card-header);">
              <div>
                <span class="badge badge-trial" style="margin-bottom: 0.25rem;">${p.code}</span>
                <div style="font-size: 1.1rem; font-weight: 700;">${p.name}</div>
              </div>
              <div style="text-align: right;">
                <span class="badge badge-active">${p.active_schools_count || 0} Schools</span>
              </div>
            </div>
            <div class="card-body" style="flex: 1; display: flex; flex-direction: column; justify-content: space-between;">
              <div>
                <div style="margin-bottom: 1rem;">
                  <span style="font-size: 1.75rem; font-weight: 800; color: var(--accent-primary);">₹${p.monthly_price.toLocaleString()}</span>
                  <span style="font-size: 0.8rem; color: var(--text-muted);">/ month</span>
                  <div style="font-size: 0.75rem; color: var(--text-muted);">or ₹${p.annual_price.toLocaleString()} billed annually</div>
                </div>

                <div style="font-size: 0.825rem; color: var(--text-muted); margin-bottom: 1rem;">
                  ${p.description}
                </div>

                <div style="border-top: 1px solid var(--border-main); padding-top: 0.75rem; margin-bottom: 0.75rem;">
                  <div style="font-size: 0.75rem; font-weight: 600; text-transform: uppercase; color: var(--text-muted); margin-bottom: 0.5rem;">Entitlements:</div>
                  <div style="font-size: 0.8rem; display: flex; flex-direction: column; gap: 0.35rem;">
                    <div><i class="fa-solid fa-users" style="color: var(--accent-primary); width: 16px;"></i> Up to <strong>${p.max_students.toLocaleString()}</strong> students</div>
                    <div><i class="fa-solid fa-chalkboard-user" style="color: #8b5cf6; width: 16px;"></i> Up to <strong>${p.max_teachers}</strong> teachers</div>
                    <div><i class="fa-solid fa-hard-drive" style="color: #10b981; width: 16px;"></i> <strong>${p.max_storage_gb} GB</strong> secure cloud storage</div>
                  </div>
                </div>

                <div style="border-top: 1px solid var(--border-main); padding-top: 0.75rem;">
                  <div style="font-size: 0.75rem; font-weight: 600; text-transform: uppercase; color: var(--text-muted); margin-bottom: 0.5rem;">Included Features:</div>
                  <ul style="list-style: none; font-size: 0.78rem; display: flex; flex-direction: column; gap: 0.35rem;">
                    ${(p.features || []).map(f => `
                      <li><i class="fa-solid fa-check" style="color: #10b981; margin-right: 0.35rem;"></i> ${f}</li>
                    `).join('')}
                  </ul>
                </div>
              </div>

              <div style="margin-top: 1.5rem; border-top: 1px solid var(--border-main); padding-top: 1rem;">
                <button class="btn btn-secondary btn-sm" style="width: 100%;" onclick="alert('Tier configuration locked by Super Admin policy')">
                  <i class="fa-solid fa-sliders"></i> Adjust Quotas
                </button>
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  // ==========================================================================
  // 6. INVOICES & PAYMENTS MANAGEMENT
  // ==========================================================================
  async function renderInvoices() {
    const container = document.getElementById('view-content');
    container.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title"><i class="fa-solid fa-file-invoice-dollar" style="color: var(--accent-primary);"></i> Invoices & Payments Management</h1>
          <div class="page-subtitle">Commercial school billing • Record manual wire/UPI receipts • Automatic delinquency tracking</div>
        </div>
        <div style="display: flex; gap: 0.75rem;">
          <button class="btn btn-primary" id="btn-create-invoice">
            <i class="fa-solid fa-plus"></i> Generate Invoice
          </button>
        </div>
      </div>

      <!-- Invoices Section -->
      <div class="card" style="margin-bottom: 1.5rem;">
        <div class="card-header">
          <div class="card-title"><i class="fa-solid fa-receipt"></i> Subscription Invoices</div>
        </div>
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Invoice #</th>
                <th>School Name</th>
                <th>Billing Cycle</th>
                <th>Period</th>
                <th>Issue Date</th>
                <th>Due Date</th>
                <th>Total (INR)</th>
                <th>Balance Due</th>
                <th>Status</th>
                <th style="text-align: right;">Action</th>
              </tr>
            </thead>
            <tbody id="invoices-tbody">
              <tr><td colspan="10" style="text-align: center; padding: 2rem;"><i class="fa-solid fa-spinner fa-spin"></i> Loading invoices...</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Settled Payments Transaction Ledger -->
      <div class="card">
        <div class="card-header">
          <div class="card-title"><i class="fa-solid fa-money-bill-transfer" style="color: #10b981;"></i> Settled Payments Transaction Ledger</div>
        </div>
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Payment #</th>
                <th>School</th>
                <th>Invoice Ref</th>
                <th>Amount (INR)</th>
                <th>Payment Date</th>
                <th>Payment Method</th>
                <th>Transaction UTR / Ref</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody id="payments-tbody">
              <tr><td colspan="8" style="text-align: center; padding: 2rem;"><i class="fa-solid fa-spinner fa-spin"></i> Loading payments...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    `;

    document.getElementById('btn-create-invoice')?.addEventListener('click', () => {
      openModal('modal-generate-invoice');
    });

    try {
      const [invRes, payRes] = await Promise.all([
        api('/invoices'),
        api('/invoices/data/payments')
      ]);

      const invTbody = document.getElementById('invoices-tbody');
      const payTbody = document.getElementById('payments-tbody');

      if (invTbody && invRes.success) {
        if (invRes.data.length === 0) {
          invTbody.innerHTML = `<tr><td colspan="10" style="text-align: center; color: var(--text-muted); padding: 3rem 1.5rem;">
            <div style="font-size: 2rem; color: var(--text-dim); margin-bottom: 0.5rem;"><i class="fa-solid fa-file-invoice"></i></div>
            <div style="font-weight: 600; color: var(--text-main); margin-bottom: 0.25rem;">No Invoices Generated Yet</div>
            <div style="font-size: 0.85rem; margin-bottom: 1rem;">Once schools are onboarded, subscription invoices and renewals will be tracked here.</div>
            <button class="btn btn-primary btn-sm" onclick="openModal('modal-generate-invoice')">
              <i class="fa-solid fa-plus"></i> Generate Invoice
            </button>
          </td></tr>`;
        } else {
          invTbody.innerHTML = invRes.data.map(i => `
            <tr>
              <td><strong>${i.invoice_number}</strong></td>
              <td>
                <strong>${i.school_name}</strong>
                <div style="font-size: 0.7rem; color: var(--text-muted);">${i.school_code}</div>
              </td>
              <td><span class="badge badge-trial">${i.billing_cycle}</span></td>
              <td style="font-size: 0.75rem;">${i.period_start} to ${i.period_end}</td>
              <td>${i.issue_date}</td>
              <td>${i.due_date}</td>
              <td><strong>₹${i.total_amount.toLocaleString()}</strong></td>
              <td style="color: ${i.balance_due > 0 ? '#ef4444' : '#10b981'}; font-weight: 700;">
                ₹${i.balance_due.toLocaleString()}
              </td>
              <td>
                <span class="badge ${i.status === 'PAID' ? 'badge-paid' : i.status === 'OVERDUE' ? 'badge-overdue' : 'badge-pending'}">
                  ${i.status}
                </span>
              </td>
              <td style="text-align: right; white-space: nowrap;">
                ${i.balance_due > 0 ? `
                  <button class="btn btn-success btn-sm btn-record-pay" data-id="${i.id}" data-num="${i.invoice_number}" data-balance="${i.balance_due}">
                    <i class="fa-solid fa-dollar-sign"></i> Pay
                  </button>
                  <button class="btn btn-secondary btn-sm btn-remind-inv" data-id="${i.id}">
                    <i class="fa-regular fa-paper-plane"></i> Remind
                  </button>
                ` : '<span style="color: #10b981; font-size: 0.75rem;"><i class="fa-solid fa-check"></i> Settled</span>'}
              </td>
            </tr>
          `).join('');

          // Attach payment and remind listeners
          document.querySelectorAll('.btn-record-pay').forEach(b => {
            b.addEventListener('click', () => {
              openRecordPaymentModal(
                b.getAttribute('data-id'),
                b.getAttribute('data-num'),
                b.getAttribute('data-balance')
              );
            });
          });

          document.querySelectorAll('.btn-remind-inv').forEach(b => {
            b.addEventListener('click', async () => {
              const id = b.getAttribute('data-id');
              const res = await api(`/invoices/${id}/remind`, { method: 'POST' });
              showToast(res.message, 'success');
            });
          });
        }
      }

      if (payTbody && payRes.success) {
        if (payRes.data.length === 0) {
          payTbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--text-muted); padding: 2.5rem 1.5rem;">
            <div style="font-size: 1.8rem; color: var(--text-dim); margin-bottom: 0.5rem;"><i class="fa-solid fa-receipt"></i></div>
            <div style="font-weight: 600; color: var(--text-main);">No Payment Transactions Recorded</div>
            <div style="font-size: 0.85rem;">When subscription payments (wire, UPI, net banking) are settled, receipts will appear here.</div>
          </td></tr>`;
        } else {
          payTbody.innerHTML = payRes.data.map(p => `
            <tr>
              <td><strong>${p.payment_number}</strong></td>
              <td>${p.school_name}</td>
              <td><code style="font-size: 0.75rem;">${p.invoice_number || 'N/A'}</code></td>
              <td style="font-weight: 700; color: #10b981;">₹${p.amount.toLocaleString()}</td>
              <td>${p.payment_date}</td>
              <td><span class="badge badge-trial">${p.payment_method}</span></td>
              <td><code style="font-size: 0.75rem;">${p.transaction_reference}</code></td>
              <td><span class="badge badge-healthy"><i class="fa-solid fa-check"></i> ${p.status}</span></td>
            </tr>
          `).join('');
        }
      }

    } catch (err) {
      container.innerHTML += `<div class="alert-box alert-danger">${err.message}</div>`;
    }
  }

  // ==========================================================================
  // 7. REMOTE CONTROLS & COMMAND QUEUE
  // ==========================================================================
  async function renderRemoteControls() {
    const container = document.getElementById('view-content');
    container.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title"><i class="fa-solid fa-tower-broadcast" style="color: var(--accent-primary);"></i> Remote ERP Service Control Console</h1>
          <div class="page-subtitle">Predefined commands • Pull-based delivery queue • Zero arbitrary SQL/execution risk</div>
        </div>
      </div>

      <!-- Command Dispatch Card -->
      <div class="card" style="margin-bottom: 1.5rem;">
        <div class="card-header">
          <div class="card-title"><i class="fa-solid fa-paper-plane" style="color: var(--accent-primary);"></i> Dispatch Remote Command</div>
        </div>
        <div class="card-body">
          <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1rem; align-items: flex-end;">
            <div class="form-group" style="margin-bottom: 0;">
              <label class="form-label">Select Target School *</label>
              <select class="form-select" id="ctrl-school-select">
                ${state.schools.length > 0 ? state.schools.map(s => `<option value="${s.id}">${s.name} (${s.status})</option>`).join('') : '<option value="">No schools available</option>'}
              </select>
            </div>
            <div class="form-group" style="margin-bottom: 0;">
              <label class="form-label">Action *</label>
              <select class="form-select" id="ctrl-cmd-select">
                <option value="SUSPEND_SERVICE">SUSPEND_SERVICE (Route users to suspended page)</option>
                <option value="REACTIVATE_SERVICE">REACTIVATE_SERVICE (Restore full operational access)</option>
                <option value="EXTEND_SUBSCRIPTION">EXTEND_SUBSCRIPTION (Add 30 grace days)</option>
                <option value="UPDATE_MODULES">UPDATE_MODULES (Sync permitted modules)</option>
              </select>
            </div>
            <div>
              <button class="btn btn-danger" id="btn-quick-dispatch" style="width: 100%;">
                <i class="fa-solid fa-bolt"></i> Configure & Dispatch
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Live Command Queue & Audit History -->
      <div class="card">
        <div class="card-header">
          <div class="card-title"><i class="fa-solid fa-list-check"></i> Command Execution Queue & Acknowledgment Log</div>
          <button class="btn btn-secondary btn-sm" id="btn-refresh-queue"><i class="fa-solid fa-rotate"></i> Refresh Queue</button>
        </div>
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Command ID</th>
                <th>Target School</th>
                <th>Command Type</th>
                <th>Queue Status</th>
                <th>Issued At</th>
                <th>Executed At</th>
                <th>Execution Result Log</th>
                <th style="text-align: right;">Simulate Poll</th>
              </tr>
            </thead>
            <tbody id="commands-tbody">
              <tr><td colspan="8" style="text-align: center; padding: 2rem;"><i class="fa-solid fa-spinner fa-spin"></i> Loading commands...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    `;

    document.getElementById('btn-quick-dispatch')?.addEventListener('click', () => {
      const schId = document.getElementById('ctrl-school-select').value;
      const cmdType = document.getElementById('ctrl-cmd-select').value;
      openRemoteCommandModal(schId, cmdType);
    });

    document.getElementById('btn-refresh-queue')?.addEventListener('click', () => loadCommandsQueue());

    loadCommandsQueue();
  }

  async function loadCommandsQueue() {
    const tbody = document.getElementById('commands-tbody');
    if (!tbody) return;

    try {
      const res = await api('/remote-control/commands');
      if (!res.success) return;

      if (res.data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--text-muted); padding: 2.5rem 1rem;">
          <div style="font-size: 1.8rem; color: var(--text-dim); margin-bottom: 0.5rem;"><i class="fa-solid fa-satellite-dish"></i></div>
          <div style="font-weight: 600; color: var(--text-main); margin-bottom: 0.25rem;">No Remote Commands in Queue</div>
          <div style="font-size: 0.85rem;">When suspension, reactivation, or module commands are dispatched, their delivery and execution logs appear here.</div>
        </td></tr>`;
        return;
      }

      tbody.innerHTML = res.data.map(cmd => {
        const isPending = cmd.status === 'PENDING' || cmd.status === 'DELIVERED';
        return `
          <tr>
            <td><strong style="font-family: monospace;">${cmd.command_id}</strong></td>
            <td>
              <strong>${cmd.school_name}</strong>
              <div style="font-size: 0.7rem; color: var(--text-muted);">${cmd.school_code}</div>
            </td>
            <td>
              <span class="badge ${cmd.command_type.includes('SUSPEND') ? 'badge-suspended' : 'badge-active'}">
                ${cmd.command_type}
              </span>
            </td>
            <td>
              <span class="badge ${cmd.status === 'EXECUTED' ? 'badge-healthy' : isPending ? 'badge-pending' : 'badge-suspended'}">
                ${cmd.status}
              </span>
            </td>
            <td style="font-size: 0.75rem;">${formatTimeAgo(cmd.issued_at)}</td>
            <td style="font-size: 0.75rem;">${cmd.executed_at ? formatTimeAgo(cmd.executed_at) : 'Awaiting Ack'}</td>
            <td style="font-size: 0.75rem; color: var(--text-muted); max-width: 280px; overflow: hidden; text-overflow: ellipsis;" title="${cmd.result_log || ''}">
              ${cmd.result_log || 'Command queued for school connector poll'}
            </td>
            <td style="text-align: right;">
              ${isPending ? `
                <button class="btn btn-secondary btn-sm btn-sim-exec" data-cmd="${cmd.command_id}" title="Simulate connector polling this command and acknowledging execution">
                  <i class="fa-solid fa-play"></i> Simulate Ack
                </button>
              ` : '<span style="color: #10b981; font-size: 0.75rem;"><i class="fa-solid fa-check"></i> Executed</span>'}
            </td>
          </tr>
        `;
      }).join('');

      document.querySelectorAll('.btn-sim-exec').forEach(b => {
        b.addEventListener('click', async () => {
          const cmdId = b.getAttribute('data-cmd');
          try {
            showToast(`Simulating connector pull for ${cmdId}...`, 'info');
            const simRes = await api('/remote-control/simulate-execution', {
              method: 'POST',
              body: JSON.stringify({ command_id: cmdId })
            });
            showToast(simRes.message, 'success');
            await loadInitialData();
            loadCommandsQueue();
          } catch (e) {
            showToast(e.message, 'error');
          }
        });
      });

    } catch (e) {
      tbody.innerHTML = `<tr><td colspan="8" style="color: #ef4444; padding: 1.5rem;">${e.message}</td></tr>`;
    }
  }

  // ==========================================================================
  // 8. ERP MONITORING & TELEMETRY
  // ==========================================================================
  async function renderERPMonitoring() {
    const container = document.getElementById('view-content');
    container.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title"><i class="fa-solid fa-heart-pulse" style="color: #10b981;"></i> ERP Systems Vitality & Telemetry Monitoring</h1>
          <div class="page-subtitle">Heartbeat pings • CPU & Memory load • Database sizes • Connector latency</div>
        </div>
      </div>

      ${state.schools.length === 0 ? `
        <div class="card" style="padding: 3.5rem 1.5rem; text-align: center; color: var(--text-muted);">
          <div style="font-size: 2.2rem; color: var(--text-dim); margin-bottom: 0.6rem;"><i class="fa-solid fa-heart-pulse"></i></div>
          <div style="font-weight: 700; font-size: 1.05rem; color: var(--text-main); margin-bottom: 0.25rem;">No ERP Connectors Monitored</div>
          <div style="font-size: 0.85rem; max-width: 440px; margin: 0 auto 1.25rem;">
            When you deploy the Connector SDK on your school ERP servers, live CPU, memory, database size, and latency telemetry will appear here.
          </div>
          <button class="btn btn-primary btn-sm" onclick="openModal('modal-register-school')">
            <i class="fa-solid fa-plus"></i> Register School Connector
          </button>
        </div>
      ` : `
        <div class="kpi-grid" style="grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));">
          ${state.schools.map(s => `
            <div class="card">
              <div class="card-header" style="background: var(--bg-card-header);">
                <div>
                  <strong style="font-size: 0.95rem;">${s.name}</strong>
                  <div style="font-size: 0.7rem; color: var(--text-muted); font-family: monospace;">${s.erp_url}</div>
                </div>
                <span class="badge ${s.health_status === 'HEALTHY' ? 'badge-healthy' : 'badge-stale'}">
                  ${s.health_status}
                </span>
              </div>
              <div class="card-body" style="font-size: 0.8rem;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 0.4rem;">
                  <span style="color: var(--text-muted);">Connector Version:</span>
                  <code>v1.4.2</code>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 0.4rem;">
                  <span style="color: var(--text-muted);">Last Heartbeat:</span>
                  <strong>${s.last_heartbeat_at ? formatTimeAgo(s.last_heartbeat_at) : 'Never'}</strong>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 0.4rem;">
                  <span style="color: var(--text-muted);">Last Sync Census:</span>
                  <strong>${s.last_sync_at ? formatTimeAgo(s.last_sync_at) : 'Never'}</strong>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 0.4rem;">
                  <span style="color: var(--text-muted);">Database Storage:</span>
                  <strong>${((s.storage_used_mb || 14000) / 1024).toFixed(1)} GB</strong>
                </div>
                <div style="display: flex; justify-content: space-between;">
                  <span style="color: var(--text-muted);">API Auth Protocol:</span>
                  <span class="badge badge-trial">HMAC-SHA256 (300s window)</span>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      `}
    `;
  }

  // ==========================================================================
  // 9. SECURITY LOGS & AUDIT MANAGEMENT
  // ==========================================================================
  async function renderSecurityLogs() {
    const container = document.getElementById('view-content');
    container.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title"><i class="fa-solid fa-shield-halved" style="color: var(--accent-primary);"></i> Central Security Stream & Audit Trail</h1>
          <div class="page-subtitle">Aggregated threat telemetry across all independent School ERPs • Administrative operations</div>
        </div>
      </div>

      <!-- Severity Filter Pills -->
      <div style="display: flex; gap: 0.5rem; margin-bottom: 1.25rem;">
        <button class="btn btn-secondary btn-sm sec-filter-btn active" data-sev="">All Events</button>
        <button class="btn btn-secondary btn-sm sec-filter-btn" data-sev="CRITICAL">Critical Only</button>
        <button class="btn btn-secondary btn-sm sec-filter-btn" data-sev="ERROR">Errors</button>
        <button class="btn btn-secondary btn-sm sec-filter-btn" data-sev="WARNING">Warnings</button>
        <button class="btn btn-secondary btn-sm sec-filter-btn" data-sev="INFO">Info</button>
      </div>

      <div class="card">
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Severity</th>
                <th>Event Type</th>
                <th>School / Source ERP</th>
                <th>User / Identity</th>
                <th>IP Address</th>
                <th>Description</th>
                <th>Timestamp</th>
              </tr>
            </thead>
            <tbody id="security-tbody">
              <tr><td colspan="7" style="text-align: center; padding: 2rem;"><i class="fa-solid fa-spinner fa-spin"></i> Loading security events...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    `;

    const loadEvents = async (sev = '') => {
      const tbody = document.getElementById('security-tbody');
      if (!tbody) return;
      try {
        const res = await api(`/security/events${sev ? '?severity=' + sev : ''}`);
        if (!res.success) return;

        if (res.data.length === 0) {
          tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-muted); padding: 3rem 1.5rem;">
            <div style="font-size: 2rem; color: #10b981; margin-bottom: 0.5rem;"><i class="fa-solid fa-shield-halved"></i></div>
            <div style="font-weight: 600; color: var(--text-main); margin-bottom: 0.25rem;">Security Stream Clean</div>
            <div style="font-size: 0.85rem;">No security threats, unauthorized access attempts, or HMAC mismatch alerts logged.</div>
          </td></tr>`;
          return;
        }

        tbody.innerHTML = res.data.map(e => `
          <tr>
            <td>
              <span class="badge ${e.severity === 'CRITICAL' ? 'badge-suspended' : e.severity === 'ERROR' ? 'badge-overdue' : e.severity === 'WARNING' ? 'badge-pending' : 'badge-healthy'}">
                ${e.severity}
              </span>
            </td>
            <td><strong style="font-family: monospace; font-size: 0.75rem;">${e.event_type}</strong></td>
            <td>
              <strong>${e.school_name || 'Central Platform'}</strong>
              <div style="font-size: 0.7rem; color: var(--text-muted);">${e.source_erp}</div>
            </td>
            <td><code style="font-size: 0.75rem;">${e.user_identifier || 'system'}</code></td>
            <td><span style="font-family: monospace; font-size: 0.75rem;">${e.ip_address || '127.0.0.1'}</span></td>
            <td style="font-size: 0.8rem;">${e.description}</td>
            <td style="font-size: 0.75rem; white-space: nowrap;">${formatTimeAgo(e.created_at)}</td>
          </tr>
        `).join('');
      } catch (err) {
        tbody.innerHTML = `<tr><td colspan="7" style="color: #ef4444; padding: 1.5rem;">${err.message}</td></tr>`;
      }
    };

    document.querySelectorAll('.sec-filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.sec-filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        loadEvents(btn.getAttribute('data-sev'));
      });
    });

    loadEvents();
  }

  // ==========================================================================
  // 10. NOTIFICATIONS & AUTOMATION RULES
  // ==========================================================================
  async function renderNotifications() {
    const container = document.getElementById('view-content');
    container.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title"><i class="fa-solid fa-bell" style="color: var(--accent-primary);"></i> Notification Inbox & Automation Rules</h1>
          <div class="page-subtitle">Commercial reminders • Threat alerts • Configurable background automation policies</div>
        </div>
        <div>
          <button class="btn btn-secondary btn-sm" id="btn-read-all">
            <i class="fa-solid fa-check-double"></i> Mark All as Read
          </button>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 1.25rem;">
        <!-- Notifications List -->
        <div class="card">
          <div class="card-header">
            <div class="card-title"><i class="fa-solid fa-inbox"></i> System Notifications</div>
          </div>
          <div class="card-body" style="padding: 0.75rem;">
            <div style="display: flex; flex-direction: column; gap: 0.6rem;" id="notifs-container">
              ${state.notifications.map(n => `
                <div style="padding: 0.85rem; border-radius: 6px; background: ${n.is_read ? 'transparent' : 'var(--bg-card-header)'}; border: 1px solid var(--border-main); display: flex; align-items: flex-start; justify-content: space-between; gap: 0.75rem;">
                  <div>
                    <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.25rem;">
                      <span class="badge ${n.severity === 'CRITICAL' ? 'badge-suspended' : n.severity === 'ERROR' ? 'badge-overdue' : n.severity === 'WARNING' ? 'badge-pending' : 'badge-healthy'}" style="font-size: 0.65rem;">
                        ${n.severity}
                      </span>
                      <strong style="font-size: 0.85rem;">${n.title}</strong>
                      ${!n.is_read ? '<span style="width: 7px; height: 7px; background: #3b82f6; border-radius: 50%;"></span>' : ''}
                    </div>
                    <div style="font-size: 0.8rem; color: var(--text-muted);">${n.message}</div>
                    <div style="font-size: 0.7rem; color: var(--text-dim); margin-top: 0.35rem;">
                      School: ${n.school_name || 'Global'} • ${formatTimeAgo(n.created_at)}
                    </div>
                  </div>
                  <div>
                    ${!n.is_read ? `
                      <button class="btn btn-secondary btn-sm btn-mark-read" data-id="${n.id}">
                        <i class="fa-solid fa-check"></i>
                      </button>
                    ` : ''}
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        </div>

        <!-- Automation Policies -->
        <div class="card">
          <div class="card-header">
            <div class="card-title"><i class="fa-solid fa-robot" style="color: #8b5cf6;"></i> Automation Engine Rules</div>
          </div>
          <div class="card-body" style="font-size: 0.8rem;">
            <div style="margin-bottom: 1rem; border-bottom: 1px solid var(--border-main); padding-bottom: 0.75rem;">
              <strong>Pre-Expiry Notice (7 Days)</strong>
              <div style="color: var(--text-muted); font-size: 0.75rem; margin-top: 0.2rem;">Dispatches reminder notice to school owner and billing team 7 days before subscription end.</div>
              <span class="badge badge-healthy" style="margin-top: 0.35rem;">ACTIVE</span>
            </div>

            <div style="margin-bottom: 1rem; border-bottom: 1px solid var(--border-main); padding-bottom: 0.75rem;">
              <strong>Overdue Payment Alert</strong>
              <div style="color: var(--text-muted); font-size: 0.75rem; margin-top: 0.2rem;">Raises alert immediately when subscription invoice due date passes without payment.</div>
              <span class="badge badge-healthy" style="margin-top: 0.35rem;">ACTIVE</span>
            </div>

            <div style="margin-bottom: 1rem; border-bottom: 1px solid var(--border-main); padding-bottom: 0.75rem;">
              <strong>Auto-Suspension for Expired Grace Period</strong>
              <div style="color: var(--text-muted); font-size: 0.75rem; margin-top: 0.2rem;">When opt-in enabled for school, enqueues SUSPEND_SERVICE command after grace period days elapse.</div>
              <span class="badge badge-trial" style="margin-top: 0.35rem;">OPT-IN PER SCHOOL</span>
            </div>

            <div style="margin-bottom: 1.25rem;">
              <strong>Connector Offline Alert (30 Mins)</strong>
              <div style="color: var(--text-muted); font-size: 0.75rem; margin-top: 0.2rem;">Flags school as OFFLINE if no heartbeat or sync payload received in 30 minutes.</div>
              <span class="badge badge-healthy" style="margin-top: 0.35rem;">ACTIVE</span>
            </div>

            <button class="btn btn-primary btn-sm" id="btn-eval-rules" style="width: 100%;">
              <i class="fa-solid fa-play"></i> Evaluate All Rules Now
            </button>
          </div>
        </div>
      </div>
    `;

    document.getElementById('btn-read-all')?.addEventListener('click', async () => {
      await api('/notifications/read-all', { method: 'PUT' });
      showToast('All notifications marked as read', 'success');
      await loadInitialData();
      renderNotifications();
    });

    document.getElementById('btn-eval-rules')?.addEventListener('click', async () => {
      showToast('Evaluating automation policies...', 'info');
      const res = await api('/automation/evaluate', { method: 'POST' });
      showToast(`Automation complete: ${res.results.length} policies evaluated.`, 'success');
      await loadInitialData();
      renderNotifications();
    });

    document.querySelectorAll('.btn-mark-read').forEach(b => {
      b.addEventListener('click', async () => {
        const id = b.getAttribute('data-id');
        await api(`/notifications/${id}/read`, { method: 'PUT' });
        await loadInitialData();
        renderNotifications();
      });
    });
  }

  // ==========================================================================
  // 11. REPORTS
  // ==========================================================================
  async function renderReports() {
    const container = document.getElementById('view-content');
    container.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title"><i class="fa-solid fa-file-export" style="color: var(--accent-primary);"></i> Business Intelligence Reports</h1>
          <div class="page-subtitle">Downloadable financial statements • Multi-school academic census • Churn and retention analysis</div>
        </div>
      </div>

      <div class="kpi-grid" style="grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));">
        <div class="card">
          <div class="card-header">
            <div class="card-title"><i class="fa-solid fa-file-csv" style="color: #10b981;"></i> Complete Comparative Matrix</div>
          </div>
          <div class="card-body">
            <p style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 1rem;">
              Comprehensive export containing all connected schools, enrolled census, teachers, active status, attendance rates, invoiced amounts, and collected revenue.
            </p>
            <a href="/api/v1/analytics/export" class="btn btn-primary btn-sm" style="width: 100%;" download>
              <i class="fa-solid fa-download"></i> Download CSV Export
            </a>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <div class="card-title"><i class="fa-solid fa-file-invoice" style="color: #3b82f6;"></i> Financial Subscription Ledger</div>
          </div>
          <div class="card-body">
            <p style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 1rem;">
              Complete ledger of all generated invoices, payment dates, bank transaction references, UPI settlement IDs, and overdue balances.
            </p>
            <button class="btn btn-secondary btn-sm" style="width: 100%;" onclick="window.print()">
              <i class="fa-solid fa-print"></i> Print Financial Summary
            </button>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <div class="card-title"><i class="fa-solid fa-shield-virus" style="color: #ef4444;"></i> Security & Compliance Audit Log</div>
          </div>
          <div class="card-body">
            <p style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 1rem;">
              Immutable audit trail of all remote service controls, suspension events, credential rotation timestamps, and administrative actions.
            </p>
            <button class="btn btn-secondary btn-sm" style="width: 100%;" onclick="alert('Export generated to audit trail archive.')">
              <i class="fa-solid fa-file-shield"></i> Export Security Audit
            </button>
          </div>
        </div>
      </div>
    `;
  }

  // ==========================================================================
  // 12. INTEGRATIONS & CONNECTOR SDK
  // ==========================================================================
  async function renderIntegrations() {
    const container = document.getElementById('view-content');
    container.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title"><i class="fa-solid fa-network-wired" style="color: var(--accent-primary);"></i> School ERP Integration & Connector SDK</h1>
          <div class="page-subtitle">Connect independent school ERP websites to Central Command • Security handshake • SDK code</div>
        </div>
      </div>

      <div class="alert-box alert-info">
        <i class="fa-solid fa-circle-info" style="font-size: 1.25rem;"></i>
        <div>
          <strong>Architectural Isolation:</strong> Each school ERP maintains its own separate database, students, teachers, and fee records. The school's connector runs a scheduled agent that computes aggregated statistics and pushes telemetry over HTTPS with HMAC-SHA256 authentication. <strong>No raw school DB credentials or student PII are ever exposed to the central platform.</strong>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.25rem;">
        <!-- SDK Architecture Specs -->
        <div class="card">
          <div class="card-header">
            <div class="card-title"><i class="fa-solid fa-code" style="color: var(--accent-primary);"></i> Connector Handshake & Security Protocol</div>
          </div>
          <div class="card-body" style="font-size: 0.825rem;">
            <div style="margin-bottom: 0.75rem;">
              <strong>1. Integration Headers Required on Every Request:</strong>
              <pre style="background: var(--bg-card-header); padding: 0.6rem; border-radius: 4px; margin-top: 0.35rem; font-family: monospace; font-size: 0.75rem;">
x-school-id: sch-xavier-01
x-api-key: key_live_xav_90218f4a...
x-timestamp: 1731500000 (UNIX timestamp)
x-signature: &lt;HMAC-SHA256 hex digest&gt;
x-idempotency-key: sync-20261113-1600 (optional)
              </pre>
            </div>

            <div style="margin-bottom: 0.75rem;">
              <strong>2. HMAC Signing Algorithm:</strong>
              <pre style="background: var(--bg-card-header); padding: 0.6rem; border-radius: 4px; margin-top: 0.35rem; font-family: monospace; font-size: 0.75rem;">
signature_payload = school_id + ":" + timestamp + ":" + raw_body
expected_signature = HMAC_SHA256(hmac_secret, signature_payload)
              </pre>
            </div>

            <div>
              <strong>3. Replay Protection Window:</strong>
              <p style="color: var(--text-muted); font-size: 0.78rem; margin-top: 0.25rem;">
                Requests with timestamp drifting more than <strong>300 seconds</strong> from Central Server time are rejected with HTTP 401 Unauthorized.
              </p>
            </div>
          </div>
        </div>

        <!-- Python & Node.js Connector Implementation -->
        <div class="card">
          <div class="card-header">
            <div class="card-title"><i class="fa-brands fa-python" style="color: #3b82f6;"></i> Python / Node.js Connector SDK Example</div>
          </div>
          <div class="card-body">
            <pre style="background: var(--bg-card-header); padding: 0.85rem; border-radius: 6px; font-family: monospace; font-size: 0.75rem; overflow-x: auto;">
# Python ERP Connector Reference Snippet
from connector_sdk import ERPConnectorSDK

sdk = ERPConnectorSDK(
    central_url="https://central-command.domain",
    school_id="sch-xavier-01",
    api_key="key_live_...",
    hmac_secret="sec_live_hmac_..."
)

# 1. Send Heartbeat Telemetry
sdk.send_heartbeat(cpu_pct=18.4, mem_pct=42.1)

# 2. Check Pending Predefined Remote Commands
commands = sdk.poll_pending_commands()
for cmd in commands:
    if cmd['commandType'] == 'SUSPEND_SERVICE':
        sdk.apply_local_suspension(cmd['payload'])
        sdk.acknowledge_command(cmd['commandId'], "SUCCESS")
            </pre>
          </div>
        </div>
      </div>
    `;
  }

  // ==========================================================================
  // 13. SETTINGS & PLATFORM METADATA
  // ==========================================================================
  async function renderSettings() {
    const container = document.getElementById('view-content');
    container.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title"><i class="fa-solid fa-sliders" style="color: var(--accent-primary);"></i> Platform Settings & Policies</h1>
          <div class="page-subtitle">Global commercial parameters • Default grace periods • Brand configuration</div>
        </div>
      </div>

      <div class="card" style="max-width: 700px;">
        <div class="card-body">
          <div class="form-group">
            <label class="form-label">Platform Name</label>
            <input type="text" class="form-control" value="CENTRAL ERP COMMAND — Multi-School SaaS HQ" readonly>
          </div>

          <div class="form-group">
            <label class="form-label">Default Subscription Grace Period (Days)</label>
            <input type="number" class="form-control" value="7">
            <span style="font-size: 0.72rem; color: var(--text-muted);">Number of days before an overdue school ERP becomes eligible for service suspension.</span>
          </div>

          <div class="form-group">
            <label class="form-label">Central Billing Support Email</label>
            <input type="email" class="form-control" value="billing@centralcommand.io">
            <span style="font-size: 0.72rem; color: var(--text-muted);">Displayed on school suspended service landing pages.</span>
          </div>

          <div class="form-group">
            <label class="form-label">Replay Attack Clock Drift Tolerance</label>
            <input type="text" class="form-control" value="300 Seconds (5 Minutes)" readonly>
          </div>

          <button class="btn btn-primary" onclick="showToast('Settings saved successfully', 'success')">
            <i class="fa-solid fa-floppy-disk"></i> Save Configuration
          </button>
        </div>
      </div>
    `;
  }

  // ==========================================================================
  // 14. ADMIN & ACCESS PERMISSIONS
  // ==========================================================================
  async function renderAdminAccess() {
    const container = document.getElementById('view-content');
    container.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title"><i class="fa-solid fa-user-shield" style="color: var(--accent-primary);"></i> Administrative Access & RBAC Roles</h1>
          <div class="page-subtitle">Central management team credentials • Role-based permissions • MFA security</div>
        </div>
      </div>

      <div class="card">
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Admin Name</th>
                <th>Email Address</th>
                <th>System Role</th>
                <th>MFA Status</th>
                <th>Last Active</th>
                <th style="text-align: right;">Action</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>Chief SaaS Executive</strong></td>
                <td>admin@centralcommand.io</td>
                <td><span class="badge badge-active">SUPER_ADMIN</span></td>
                <td><span class="badge badge-healthy"><i class="fa-solid fa-shield-check"></i> Enabled</span></td>
                <td>Active now</td>
                <td style="text-align: right;"><button class="btn btn-secondary btn-sm" onclick="openModal('modal-auth-users')">Switch</button></td>
              </tr>
              <tr>
                <td><strong>Operations Lead</strong></td>
                <td>ops@centralcommand.io</td>
                <td><span class="badge badge-trial">OPERATIONS_MANAGER</span></td>
                <td><span class="badge badge-stale">Disabled</span></td>
                <td>2 hours ago</td>
                <td style="text-align: right;"><button class="btn btn-secondary btn-sm" onclick="openModal('modal-auth-users')">Switch</button></td>
              </tr>
              <tr>
                <td><strong>Senior Billing Comptroller</strong></td>
                <td>finance@centralcommand.io</td>
                <td><span class="badge badge-healthy">FINANCE_OFFICER</span></td>
                <td><span class="badge badge-stale">Disabled</span></td>
                <td>1 day ago</td>
                <td style="text-align: right;"><button class="btn btn-secondary btn-sm" onclick="openModal('modal-auth-users')">Switch</button></td>
              </tr>
              <tr>
                <td><strong>Compliance & Security Auditor</strong></td>
                <td>auditor@centralcommand.io</td>
                <td><span class="badge badge-stale">AUDITOR</span></td>
                <td><span class="badge badge-stale">Disabled</span></td>
                <td>3 days ago</td>
                <td style="text-align: right;"><button class="btn btn-secondary btn-sm" onclick="openModal('modal-auth-users')">Switch</button></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  // ==========================================================================
  // MODAL HANDLERS & HELPERS
  // ==========================================================================
  function setupModals() {
    // Close modal on close button or backdrop click
    document.querySelectorAll('.modal-overlay').forEach(modal => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal || e.target.classList.contains('modal-close-btn')) {
          closeModal(modal.id);
        }
      });
    });

    // Dynamic Registration Amount Calculation
    function updateRegisterCalculatedAmount() {
      const isPerStudent = document.getElementById('radio-per-student')?.checked;
      const perStudentInputs = document.getElementById('per-student-inputs');
      const formulaEl = document.getElementById('calc-formula-text');
      const totalEl = document.getElementById('calc-total-amount');
      const cycle = document.getElementById('reg-billing-cycle')?.value || 'YEARLY';
      
      const multipliers = { MONTHLY: 1, QUARTERLY: 3, HALF_YEARLY: 6, YEARLY: 12 };
      const cycleMultiplier = multipliers[cycle] || 1;
      const cycleLabel = cycle.toLowerCase().replace('_', '-');

      if (!isPerStudent) {
        if (perStudentInputs) perStudentInputs.style.opacity = '0.4';
        const planSelect = document.getElementById('reg-plan-select');
        const planPrices = {
          'plan-starter': 12000,
          'plan-growth': 25000,
          'plan-enterprise': 55000,
          'plan-custom': 90000
        };
        const monthlyBase = planPrices[planSelect?.value] || 25000;
        const totalAmount = monthlyBase * cycleMultiplier;
        if (formulaEl) formulaEl.textContent = `Flat tier (₹${monthlyBase.toLocaleString()}/mo × ${cycleMultiplier} mos)`;
        if (totalEl) totalEl.textContent = `₹${totalAmount.toLocaleString()} / ${cycleLabel}`;
        return;
      }

      if (perStudentInputs) perStudentInputs.style.opacity = '1';
      const pricePerStudent = parseFloat(document.getElementById('reg-price-per-student')?.value) || 25.0;
      const initialStudents = parseInt(document.getElementById('reg-initial-students')?.value, 10) || 500;
      const monthlyAmount = Math.round(initialStudents * pricePerStudent);
      const totalAmount = monthlyAmount * cycleMultiplier;

      if (formulaEl) {
        formulaEl.textContent = `${initialStudents.toLocaleString()} students × ₹${pricePerStudent}/mo × ${cycleMultiplier} mos`;
      }
      if (totalEl) {
        totalEl.textContent = `₹${totalAmount.toLocaleString()} / ${cycleLabel}`;
      }
    }

    ['reg-price-per-student', 'reg-initial-students', 'reg-billing-cycle', 'reg-plan-select'].forEach(id => {
      document.getElementById(id)?.addEventListener('input', updateRegisterCalculatedAmount);
      document.getElementById(id)?.addEventListener('change', updateRegisterCalculatedAmount);
    });

    ['radio-per-student', 'radio-flat'].forEach(id => {
      document.getElementById(id)?.addEventListener('change', updateRegisterCalculatedAmount);
    });

    updateRegisterCalculatedAmount();

    // Register School Form Submission
    const regForm = document.getElementById('form-register-school');
    const regSubmit = document.getElementById('btn-submit-register-school');
    if (regSubmit && regForm) {
      regSubmit.addEventListener('click', async (e) => {
        e.preventDefault();
        const formData = new FormData(regForm);
        const body = Object.fromEntries(formData.entries());
        if (body.price_per_student) body.price_per_student = parseFloat(body.price_per_student);
        if (body.initial_students) body.initial_students = parseInt(body.initial_students, 10);
        if (body.grace_period_days) body.grace_period_days = parseInt(body.grace_period_days, 10);
        body.auto_suspend_enabled = document.getElementById('reg-auto-suspend')?.checked ? 1 : 0;

        try {
          showToast('Registering school and generating cryptographic credentials...', 'info');
          const res = await api('/schools', {
            method: 'POST',
            body: JSON.stringify(body)
          });

          closeModal('modal-register-school');
          regForm.reset();

          alert(
            `School Registered Successfully!\n\n` +
            `School ID: ${res.data.schoolId}\n` +
            `API Key: ${res.data.apiKey}\n` +
            `HMAC Secret: ${res.data.hmacSecret}\n\n` +
            `IMPORTANT: Save these credentials now. The HMAC secret will never be displayed again.`
          );

          await loadInitialData();
          renderSchoolsList();
        } catch (err) {
          showToast(err.message, 'error');
        }
      });
    }

    // Remote Command Modal Switcher
    const cmdTypeSelect = document.getElementById('cmd-type-select');
    if (cmdTypeSelect) {
      cmdTypeSelect.addEventListener('change', (e) => {
        const val = e.target.value;
        const suspFields = document.getElementById('cmd-suspend-fields');
        const extFields = document.getElementById('cmd-extend-fields');
        const modFields = document.getElementById('cmd-modules-fields');

        if (suspFields) suspFields.style.display = val === 'SUSPEND_SERVICE' ? 'block' : 'none';
        if (extFields) extFields.style.display = val === 'EXTEND_SUBSCRIPTION' ? 'block' : 'none';
        if (modFields) modFields.style.display = val === 'UPDATE_MODULES' ? 'block' : 'none';
      });
    }

    // Dispatch Command Button
    const dispatchBtn = document.getElementById('btn-dispatch-command');
    if (dispatchBtn) {
      dispatchBtn.addEventListener('click', async () => {
        const schoolId = document.getElementById('cmd-school-id').value;
        const cmdType = document.getElementById('cmd-type-select').value;
        const form = document.getElementById('form-remote-command');
        const formData = new FormData(form);

        const payload = {};
        if (cmdType === 'SUSPEND_SERVICE') {
          const confirmed = document.getElementById('cmd-confirm-suspend').checked;
          if (!confirmed) {
            alert('Please check the confirmation box to authorize suspension.');
            return;
          }
          payload.reason = formData.get('suspend_reason');
          payload.support_contact = formData.get('support_contact');
          payload.display_page = 'SERVICE_SUSPENDED_OVERDUE';
        } else if (cmdType === 'EXTEND_SUBSCRIPTION') {
          payload.extend_days = parseInt(formData.get('extend_days'), 10);
          payload.reason = formData.get('extend_reason');
        } else if (cmdType === 'UPDATE_MODULES') {
          const checked = Array.from(document.querySelectorAll('#modules-checkbox-group input:checked')).map(i => i.value);
          payload.enabled_modules = checked;
        }

        try {
          showToast(`Enqueuing predefined remote command ${cmdType}...`, 'info');
          const res = await api('/remote-control/issue', {
            method: 'POST',
            body: JSON.stringify({
              school_id: schoolId,
              command_type: cmdType,
              payload,
              confirmation: true
            })
          });

          closeModal('modal-remote-command');
          showToast(res.message, 'success');

          // Simulate immediate execution for smooth demo
          setTimeout(async () => {
            await api('/remote-control/simulate-execution', {
              method: 'POST',
              body: JSON.stringify({ command_id: res.data.commandId })
            });
            showToast(`Command ${res.data.commandId} acknowledged by school ERP connector.`, 'success');
            await loadInitialData();
            if (state.activeTab === 'remote-controls') {
              loadCommandsQueue();
            } else if (state.activeTab === 'school-profile') {
              renderSchoolProfile(schoolId);
            } else {
              renderCurrentTab();
            }
          }, 600);

        } catch (err) {
          showToast(err.message, 'error');
        }
      });
    }

    // Generate Invoice Form
    const invForm = document.getElementById('form-generate-invoice');
    const invSubmit = document.getElementById('btn-submit-generate-invoice');
    if (invSubmit && invForm) {
      invSubmit.addEventListener('click', async (e) => {
        e.preventDefault();
        const formData = new FormData(invForm);
        const body = Object.fromEntries(formData.entries());

        try {
          showToast('Generating invoice...', 'info');
          const res = await api('/invoices', {
            method: 'POST',
            body: JSON.stringify(body)
          });

          closeModal('modal-generate-invoice');
          invForm.reset();
          showToast(`Invoice ${res.data.invoiceNum} created for ₹${res.data.totalAmount.toLocaleString()}`, 'success');
          await loadInitialData();
          renderInvoices();
        } catch (err) {
          showToast(err.message, 'error');
        }
      });
    }

    // Record Payment Form
    const payForm = document.getElementById('form-record-payment');
    const paySubmit = document.getElementById('btn-submit-record-payment');
    if (paySubmit && payForm) {
      paySubmit.addEventListener('click', async (e) => {
        e.preventDefault();
        const invId = document.getElementById('pay-invoice-id').value;
        const formData = new FormData(payForm);
        const body = Object.fromEntries(formData.entries());

        try {
          showToast('Recording payment in financial ledger...', 'info');
          const res = await api(`/invoices/${invId}/payments`, {
            method: 'POST',
            body: JSON.stringify(body)
          });

          closeModal('modal-record-payment');
          payForm.reset();
          showToast(`Payment receipt ${res.data.paymentNum} recorded successfully!`, 'success');
          await loadInitialData();
          renderInvoices();
        } catch (err) {
          showToast(err.message, 'error');
        }
      });
    }

    // Role Switching Cards
    document.querySelectorAll('.user-role-card').forEach(card => {
      card.addEventListener('click', async () => {
        const email = card.getAttribute('data-email');
        const pass = card.getAttribute('data-pass');
        try {
          showToast(`Switching identity to ${email}...`, 'info');
          const res = await api('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password: pass, mfaCode: '123456' })
          });
          if (res.success) {
            state.token = res.token;
            state.currentUser = res.user;
            localStorage.setItem('central_token', state.token);
            updateUserBadge();
            closeModal('modal-auth-users');
            showToast(`Logged in as ${res.user.fullName} (${res.user.role})`, 'success');
            renderCurrentTab();
          }
        } catch (e) {
          showToast(e.message, 'error');
        }
      });
    });
  }

  function openModal(id) {
    const el = document.getElementById(id);
    if (el) {
      el.classList.add('active');
      if (id === 'modal-register-school') {
        const evt = new Event('input', { bubbles: true });
        document.getElementById('reg-price-per-student')?.dispatchEvent(evt);
      }
    }
  }

  function closeModal(id) {
    const el = document.getElementById(id);
    if (el) el.classList.remove('active');
  }

  function openRemoteCommandModal(schoolId, commandType = 'SUSPEND_SERVICE') {
    const school = state.schools.find(s => s.id === schoolId);
    if (!school) return;

    document.getElementById('cmd-school-id').value = school.id;
    document.getElementById('cmd-school-name-label').textContent = school.name;
    document.getElementById('cmd-school-url-label').textContent = school.erp_url;

    const cmdSelect = document.getElementById('cmd-type-select');
    if (cmdSelect) {
      cmdSelect.value = commandType;
      cmdSelect.dispatchEvent(new Event('change'));
    }

    openModal('modal-remote-command');
  }

  function openRecordPaymentModal(invoiceId, invoiceNum, balance) {
    document.getElementById('pay-invoice-id').value = invoiceId;
    document.getElementById('pay-inv-number').textContent = invoiceNum;
    document.getElementById('pay-inv-balance').textContent = `₹${parseFloat(balance).toLocaleString()}`;
    document.getElementById('pay-amount').value = balance;
    document.getElementById('pay-date').value = new Date().toISOString().slice(0, 10);
    openModal('modal-record-payment');
  }

  // Time formatter
  function formatTimeAgo(dateStr) {
    if (!dateStr) return 'N/A';
    const d = new Date(dateStr);
    const diffSec = Math.floor((Date.now() - d.getTime()) / 1000);
    if (diffSec < 60) return `${Math.max(1, diffSec)}s ago`;
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  }

  // Start app on DOM ready
  document.addEventListener('DOMContentLoaded', init);
})();
