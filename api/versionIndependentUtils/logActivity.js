const logger = require( '../../logger' );

const logActivity = ( req, msg, level = 'info', rest = { } ) =>
{
  const ip = req.headers[ 'x-forwarded-for' ] || req.connection.remoteAddress;

  switch ( level )
  {
    case 'info':
      logger.info( msg, { userId: req.session.userId ? req.session.userId : null, ip,
        method: req.method, url: req.originalUrl, ...rest } );
      break;
    case 'warn':
      logger.warn( msg, { userId: req.session.userId ? req.session.userId : null, ip,
        method: req.method, url: req.originalUrl, ...rest } );
      break;
    case 'error':
      logger.error( msg, { userId: req.session.userId ? req.session.userId : null, ip,
        method: req.method, url: req.originalUrl, ...rest } );
      break;
    default:
      break;
  }
};

module.exports = logActivity;
