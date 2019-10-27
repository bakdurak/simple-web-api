const config = require( '../../../config' );
const imgSizes = config.uploads.UPLOAD_PX_SIZES;
const makeSharpTask = require( './makeSharpTask' );

async function processImgsBySharp ( imgBuff )
{
  const sharpTasksProcessing = [ ];
  for ( const size in imgSizes )
  {
    sharpTasksProcessing.push( makeSharpTask( imgBuff, imgSizes[ size ], config.uploads.JPEG_QUALITY ) );
  }
  // Process original with very high quality to do copy ( without re-compression ) from it if required
  sharpTasksProcessing.push( makeSharpTask( imgBuff, config.uploads.ORIGINAL_IMG_SIZE, 95 ) );
  const imgBuffs = await Promise.all( sharpTasksProcessing );

  return imgBuffs;
}

module.exports = processImgsBySharp;
