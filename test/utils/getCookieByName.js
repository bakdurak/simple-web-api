function getCookieByName ( res, name )
{
  const cookies = res.headers[ 'set-cookie' ];
  let cookieVals;
  let needle = null;
  for ( let i = 0; i < cookies.length; i++ )
  {
    cookieVals = cookies[ i ].split( '=' );
    if ( cookieVals[ 0 ] !== name ) continue;
    needle = cookies[ i ]
      .split( ';' )
      [ 0 ];
    break;
  }

  return needle;
}

module.exports = getCookieByName;
