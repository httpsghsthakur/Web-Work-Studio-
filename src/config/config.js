const path = require('path');
require('dotenv').config();

module.exports = {
  PORT: process.env.PORT || 4000,
  NODE_ENV: process.env.NODE_ENV || 'production',
  JWT_SECRET: process.env.JWT_SECRET || 'central-erp-super-secret-jwt-key-992182749',
  JWT_EXPIRES_IN: '12h',
  DB_PATH: process.env.DB_PATH || path.join(__dirname, '../../data/central_erp.sqlite'),
  REPLAY_WINDOW_SECONDS: 300, // 5 minutes max clock drift
  DEFAULT_GRACE_PERIOD_DAYS: 7,
  RATE_LIMIT_WINDOW_MS: 60 * 1000,
  RATE_LIMIT_MAX_REQUESTS: 120,
};
