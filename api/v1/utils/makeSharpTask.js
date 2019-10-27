// Image processing lib
const sharp = require( 'sharp' );

function makeSharpTask ( imgBuff, size, quality )
{
  return sharp( imgBuff )
    .resize( size, size, {
      fit: 'inside', // Keep aspect ratio
      withoutEnlargement: true
    } )
    .toFormat( 'jpg' )
    .flatten( {
      background: {
        r: 255, g: 255, b: 255 // Fill alpha channel with white color
      }
    } )
    .jpeg( {
      quality,
      chromaSubsampling: '4:4:4',
      progressive: true
    } )
    .toBuffer();
}

module.exports = makeSharpTask;
