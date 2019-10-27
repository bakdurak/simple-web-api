const path = require( 'path' );
const config = require( '../../../config' );
let imgSizes = config.uploads.UPLOAD_PX_SIZES;
const emptyStubFunc = require( './emptyStubFunction' );

// For saving images to FS
const fs = require( 'fs' );

function writeImgV1 ( imgBuf, root, imgTypeDir,  subDirs, imgId )
{
  return fs.writeFile( path.join( root, imgTypeDir.toString(), subDirs, `${imgId}.jpg` ),
    imgBuf, emptyStubFunc );
}

async function saveImgsToFs ( imgBuffs, root, subDirs, imgId )
{
  const fsTaskSave = [ ];
  imgSizes = Object.values( imgSizes );
  for ( let i = 0; i < imgSizes.length; i++ )
  {
    fsTaskSave.push( writeImgV1( imgBuffs[ i ], root, imgSizes[ i ], subDirs, imgId ) );
  }
  // Save original
  fsTaskSave.push( writeImgV1( imgBuffs[ imgBuffs.length - 1 ], root,
    config.uploads.DIR_FOR_STORE_ORIGINAL_IMGS, subDirs, imgId ) );
  await Promise.all( fsTaskSave );
  return fsTaskSave;
}

module.exports = saveImgsToFs;
