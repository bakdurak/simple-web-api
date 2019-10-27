const logActivity = require( '../../versionIndependentUtils/logActivity' );
const config = require( '../../../config' );

const validateCsrf = ( req, res, next ) =>
{
  // If user is authorized then he might be subjected with csrf attack
  if ( req.session.userId )
  {
    // Compare csrf cookie and header ( Csrf protect - Double Submit Cookie )
    if ( req.cookies[ config.auth.CSRF_COOKIE_NAME ] &&
      req.headers[ config.auth.CSRF_HEADER_NAME ] &&
      ( req.cookies[ config.auth.CSRF_COOKIE_NAME ] === req.headers[ config.auth.CSRF_HEADER_NAME ] ) )
    {
      next();
    }
    else
    {
      res.cookie( config.auth.CSRF_COOKIE_NAME, '', { expires: new Date( 0 ) } );
      res.cookie( config.auth.SESSION_NAME, '', { expires: new Date( 0 ) } );
      res.status( 419 ).end();

      // Log suspicious activity
      logActivity( req, 'Invalid csrf token', 'warn' );

      // We don't need to wait until session will be removed
      req.session.destroy();
    }
  }
  else next();
};

module.exports = validateCsrf;
