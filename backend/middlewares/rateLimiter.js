import rateLimit from 'express-rate-limit';

const isLocalhost = (req) => {
  const ip = req.ip || req.connection?.remoteAddress || req.socket?.remoteAddress || '';
  return (
    ip === '127.0.0.1' || 
    ip === '::1' || 
    ip === 'localhost' || 
    ip.includes('127.0.0.1') ||
    ip === '::ffff:127.0.0.1' ||
    process.env.NODE_ENV !== 'production'
  );
};

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10000, // relaxed limit per IP
  skip: (req) => isLocalhost(req),
  message: { error: 'Too many requests from this IP, please try again later.' }
});

export const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 1000, // relaxed upload limit per IP
  skip: (req) => isLocalhost(req),
  message: { error: 'Upload limit reached. Please wait.' }
});
