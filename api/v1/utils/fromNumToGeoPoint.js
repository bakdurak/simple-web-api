const config = require( '../../../config' );
const BusinessRuleException = require( '../../versionIndependentUtils/BusinessRuleException' );

// It's necessary to cut off geoCoord array to 2 elements
// Because mongoose and mongodb don't check array length
/**
 * @param geoCoord is array where the first index presents longitude
 * and the second - latitude
 * @returns {{coordinates: (*|number)[], type: string}}
 */
function fromNumToGeoPoint ( geoCoord )
{
  // Restrict coordinates precision with x sign after comma
  const precision = config.common.GEO_POINT_PRECISION;

  let longitude;
  let latitude;
  if ( geoCoord[ 0 ] && geoCoord[ 1 ] )
  {
    longitude = geoCoord[ 0 ] % 180;
    latitude = geoCoord[ 1 ] % 90;

    longitude = Number( longitude.toFixed( precision ) );
    latitude = Number( latitude.toFixed( precision ) );
  }
  else
  {
    throw new BusinessRuleException( 400, 'Wrong coordinates', config.errorLevels.info );
  }

  return { type: 'Point', coordinates: [ longitude, latitude ] };
}

module.exports = fromNumToGeoPoint;
