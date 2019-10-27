const isObject = require( './isObject' );
const BusinessRuleException = require( '../../versionIndependentUtils/BusinessRuleException' );
const config = require( '../../../config' );

function sanitizeObjByScheme ( obj, scheme, maxDepth, curDepth = 0 )
{
  curDepth += 1;
  if ( curDepth === maxDepth ) throw new BusinessRuleException( 400, 'Invalid query string',
    config.errorLevels.info );

  for ( const prop in obj )
  {
    if ( Object.prototype.hasOwnProperty.call( scheme, prop ) )
    {
      if ( isObject( obj[ prop ] ) )
      {
        if ( isObject( scheme[ prop ] ) )
        {
          sanitizeObjByScheme( obj[ prop ], scheme[ prop ], maxDepth, curDepth );
        }
        else
        {
          delete obj[ prop ];
        }
      }
      else
      {
        if ( ( isObject( scheme[ prop ] ) ) || ( typeof obj[ prop ] !== scheme[ prop ] ) )
        {
          delete obj[ prop ];
        }
      }
    }
    else
    {
      delete obj[ prop ];
    }
  }
}

module.exports = sanitizeObjByScheme;
