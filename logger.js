import { createLogger, format, transports } from 'winston';

const { combine, timestamp, printf, errors, colorize, metadata } = format;

const myFormat = printf(({ level, message, timestamp, ...metadata }) => {
  let log = `${timestamp} ${level}: ${message}`;
  if (Object.keys(metadata).length > 0) {
    log += ` ${JSON.stringify(metadata)}`;
  }
  return log;
});

const logger = createLogger({
  level: process.env.LOG_LEVEL || 'debug',
  format: combine(
    colorize(),
    timestamp({
      format: 'YYYY-MM-DD HH:mm:ss.SSS',
    }),
    errors({ stack: true }),
    metadata({ fillExcept: ['message', 'level', 'timestamp'] }),
    myFormat
  ),
  transports: [
    new transports.Console()
  ],
});

export default logger;