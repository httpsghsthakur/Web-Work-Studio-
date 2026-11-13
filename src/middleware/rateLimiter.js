const config = require('../config/config');

// In-memory sliding window rate limiter
const ipRequestCounts = new Map();

function rateLimiter(req, res, next) {
  const ip = req.ip || req.connection.remoteAddress || '127.0.0.1';
  const now = Date.now();

  let record = ipRequestCounts.get(ip);
  if (!record) {
    record = { count: 1, resetTime: now + config.RATE_LIMIT_WINDOW_MS };
    ipRequestCounts.set(ip, record);
    return next();
  }

  if (now > record.resetTime) {
    record.count = 1;
    record.resetTime = now + config.RATE_LIMIT_WINDOW_MS;
    return next();
  }

  record.count += 1;
  if (record.count > config.RATE_LIMIT_MAX_REQUESTS) {
    return res.status(429).json({
      success: false,
      error: 'Too many requests. Please wait a moment before retrying.',
      retryAfterSeconds: Math.ceil((record.resetTime - now) / 1000)
    });
  }

  next();
}

// Periodic cleanup of expired rate limit keys every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ip, record] of ipRequestCounts.entries()) {
    if (now > record.resetTime) {
      ipRequestCounts.delete(ip);
    }
  }
}, 5 * 60 * 1000);

module.exports = rateLimiter;
