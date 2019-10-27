const BusinessRuleException = require( '../../versionIndependentUtils/BusinessRuleException' );
const logActivity = require( '../../versionIndependentUtils/logActivity' );
const { errorLevels } = require( '../../../config' );
const { info } = errorLevels;

// eslint-disable-next-line no-unused-vars
const errorHandler = ( error, req, res, next ) =>
{
  // If error produced by our application not third party module
  // Then we can share to end user with our error text
  if ( error instanceof BusinessRuleException )
  {
    res.status( error.status ).json( error.message );

    if ( error.level <= info )
    {
      logActivity( req, error.message, 'info', error.rest );
    }
  }
  // Exception to above rule - mongoose validation error
  else if ( error.name && error.name === 'ValidationError' )
  {
    res.status( 400 ).json( 'ValidationError' );
  }
  // If it's not planned error
  else
  {
    res.status( 500 ).json( 'Server error' );

    if ( error.message )
    {
      logActivity( req, error.message, 'error' );
    }
    else
    {
      logActivity( req, null, 'error', error );
    }
  }
};

module.exports = errorHandler;
