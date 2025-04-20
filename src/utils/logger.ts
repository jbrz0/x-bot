import pino from 'pino';
import dotenv from 'dotenv';

dotenv.config(); // Load environment variables from .env file

const logLevel = process.env.LOG_LEVEL || 'info';

const logger = pino({
  level: logLevel,
  transport: {
    target: 'pino-pretty', // Make logs pretty in development
    options: {
      colorize: true,
      ignore: 'pid,hostname', // Ignore pid and hostname for cleaner logs
      translateTime: 'SYS:standard', // Use standard time format
    },
  },
});

export default logger; 