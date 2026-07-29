import { logger } from '../utils/logger.js';

export const errorHandler = (err, req, res, next) => {
  logger.error(err.message, { stack: err.stack, path: req.path });
  
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    error: err.message,
    stack: err.stack
  });
};
