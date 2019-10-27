const generateCsrfToken = require( './generateCsrfToken' );
const config = require( '../../../config' );

const issueCsrfToken = async ( res ) =>
{
  const token = await generateCsrfToken();
  res.cookie( config.auth.CSRF_COOKIE_NAME, token );
  res.header( config.auth.CSRF_HEADER_NAME, token );
};

module.exports = issueCsrfToken;
