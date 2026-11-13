const express = require('express');
const cors = require('cors');
const path = require('path');
const config = require('./config/config');
const rateLimiter = require('./middleware/rateLimiter');

// Import routes
const authRoutes = require('./routes/authRoutes');
const schoolRoutes = require('./routes/schoolRoutes');
const subscriptionRoutes = require('./routes/subscriptionRoutes');
const invoiceRoutes = require('./routes/invoiceRoutes');
const remoteControlRoutes = require('./routes/remoteControlRoutes');
const securityRoutes = require('./routes/securityRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const connectorApiRoutes = require('./routes/connectorApiRoutes');

const app = express();

// Trust proxy for IP checking behind reverse proxy / load balancers
app.set('trust proxy', 1);

// Global middleware
app.use(cors());
app.use(rateLimiter);

// Capture raw body for byte-level HMAC signature verification
app.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf.toString('utf8');
  }
}));
app.use(express.urlencoded({ extended: true }));

// Serve frontend static files
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/schools', schoolRoutes);
app.use('/api/v1/plans', subscriptionRoutes);
app.use('/api/v1/invoices', invoiceRoutes);
app.use('/api/v1/remote-control', remoteControlRoutes);
app.use('/api/v1/security', securityRoutes);
app.use('/api/v1/analytics', analyticsRoutes);
app.use('/api/v1/notifications', notificationRoutes);
app.use('/api/v1/connector', connectorApiRoutes);

// System Health Check endpoint
app.get('/api/v1/health', (req, res) => {
  res.json({
    status: 'ONLINE',
    platform: 'CENTRAL ERP COMMAND',
    version: '2.4.0-enterprise',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// Single Page Application Fallback
app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ success: false, error: 'Endpoint not found' });
  }
  const indexPath = path.join(__dirname, 'public', 'index.html');
  res.sendFile(indexPath);
});

// Global Central Error Handler
app.use((err, req, res, next) => {
  console.error('[Unhandled Server Error]', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error occurred',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Start server if run directly
if (require.main === module) {
  const server = app.listen(config.PORT, () => {
    console.log(`================================================================`);
    console.log(`  CENTRAL ERP COMMAND - Multi-School Management & BI Platform`);
    console.log(`  Server running at: http://localhost:${config.PORT}`);
    console.log(`  Environment: ${config.NODE_ENV}`);
    console.log(`================================================================`);
  });
}

module.exports = app;
