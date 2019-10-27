const BusinessRuleException = require( '../../versionIndependentUtils/BusinessRuleException' );
const config = require( '../../../config' );

function toGeoSearch ( longitude, latitude, center )
{
  longitude = Number( longitude );
  latitude = Number( latitude );
  center = Number( center );

  if ( ( typeof longitude !== 'number' ) || ( typeof  latitude !== 'number' )
    || ( typeof center !== 'number' ) )
  {
    throw new BusinessRuleException( 400, 'Wrong geo format', config.errorLevels.info );
  }

  if ( isNaN( longitude ) || isNaN( latitude ) || isNaN( center ) )
  {
    throw new BusinessRuleException( 400, 'Wrong geo format', config.errorLevels.info );
  }

  return { $geoWithin: { $centerSphere: [ [ longitude, latitude ], center ] } };
}

module.exports = toGeoSearch;
