const config = require( '../../../config' );
const crypto = require( 'crypto' );

const generateCsrfToken = async (  ) =>
{
  const buf = await crypto.randomBytes( config.auth.CSRF_TOKEN_LENGTH );
  return ( buf.toString( 'hex' ) );
};

module.exports = generateCsrfToken;
