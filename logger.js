require( 'dotenv' ).config();
const { createLogger, format, transports } = require( 'winston' );
require( 'winston-daily-rotate-file' );
const { combine, timestamp } = format;

const dirname = process.env.LOGS_DIR;
const info = new ( transports.DailyRotateFile )( {
  level: 'info',
  filename: '%DATE%-info.log',
  datePattern: 'YYYY-MM-DD-HH',
  dirname,
  frequency: '24h',
  zippedArchive: true,
  maxSize: '20m',
  maxFiles: '14d'
} );
const error = new transports.File(
  { filename: `${dirname}/error.log`, level: 'error' } );

const logger = createLogger( {
  format: combine(
    timestamp(),
    format.json()
  ),

  transports: [
    info,
    error
  ]
} );

module.exports = logger;
