const config = require( '../../../config' );
const pify = require( 'pify' );
const path = require( 'path' );

// For creating directories hierarchy
// Is a portable module (relative to operating systems)
let mkdirp = require( 'mkdirp' );
mkdirp = pify( mkdirp );

const imgSizes = config.uploads.UPLOAD_PX_SIZES;

async function createDirectories ( root, subDirs )
{
  const mkdirpTasks = [ ];
  // For original
  mkdirpTasks.push( mkdirp(
    path.join( root, config.uploads.DIR_FOR_STORE_ORIGINAL_IMGS, subDirs ) ) );

  for ( const size in imgSizes )
  {
    mkdirpTasks.push( mkdirp( path.join( root, imgSizes[ size ].toString(), subDirs ) ) );
  }

  await Promise.all( mkdirpTasks );
}

module.exports = createDirectories;
