const rateLimit = require('express-rate-limit')

// Rate limiter for TOTP requests
export const totpRateLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 3, // Limit each IP to 3 requests per windowMs
  message: 'Too many requests for TOTP, please try again later.',
})

/**
 * Create and send new game sms
 */
