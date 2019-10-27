const sanitizeBody = ( req, res, next ) =>
{
  for ( const prop in req.body )
  {
    // eslint-disable-next-line max-len
    if ( ! ( ( typeof req.body[ prop ] === 'string' ) || ( typeof req.body[ prop ] === 'number' ) ) )
    {
      delete req.body[ prop ];
    }
  }

  next();
};

module.exports = sanitizeBody;
