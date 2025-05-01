import pino from 'pino';
import dotenv from 'dotenv';

dotenv.config(); // Load environment variables from .env file

const logLevel = process.env.LOG_LEVEL || 'info';
const isProduction = process.env.NODE_ENV === 'production';

// Configure transport based on environment
const transport = isProduction
  ? // Production: Standard JSON output to stdout
    undefined 
  : // Development: Pretty-printed output
    {
      target: 'pino-pretty', // Make logs pretty in development
      options: {
        colorize: true,
        ignore: 'pid,hostname', // Ignore pid and hostname for cleaner logs
        translateTime: 'SYS:standard', // Use standard time format
      },
    };

const logger = pino({
  level: logLevel,
  transport,
});

// Log environment info once on startup
logger.info(`Logger initialized. Level: ${logLevel}. Environment: ${isProduction ? 'production' : 'development'}.`);

export default logger; 