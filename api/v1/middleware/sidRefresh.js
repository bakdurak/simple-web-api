const config = require( '../../../config' );
const issueCsrfToken = require( '../utils/issueCsrfToken' );

const sidRefresh = async ( req, res, next ) =>
{
  // Update sid if it is out of date
  if ( req.session && req.session.createdAt )
  {
    const currentTime = new Date().getTime();
    const diff = ( currentTime - new Date( req.session.createdAt ) );
    const oldSession = diff > config.auth.SID_EXPIRES;
    if ( oldSession )
    {
      await issueCsrfToken( res );

      const userId = req.session.userId;
      await new Promise( ( resolve ) =>
      {
        req.session.regenerate( () =>
        {
          req.session.userId = userId;
          req.session.createdAt = new Date();

          resolve( );
        } );
      } );
    }
  }

  next();
};

module.exports = sidRefresh;
