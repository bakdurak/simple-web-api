const BusinessRuleException = require( '../../versionIndependentUtils/BusinessRuleException' );
const config = require( '../../../config' );

const requireAuthentication = ( req, res, next ) =>
{
  if ( req.session.userId )
  {
    next();
  }
  else
  {
    throw new BusinessRuleException( 401, 'Require auth', config.errorLevels.warn,
      { sid: req.cookies[ config.auth.SESSION_NAME ]
        ? req.cookies[ config.auth.SESSION_NAME ]
        : null } );
  }
};

module.exports = requireAuthentication;
