const md5 = require( 'md5' );
// Use md5 ability of uniform value distribution
// To fill directories with images
// And eliminate 'directories holes'

/**
 * /root/size/dir1/dir2/.../dirN/someImg.jpg - Path pattern
 * @param id - img id
 * @param dirDepth N in above path pattern
 * @param symbolsPerSubDir symbol count per dirM name
 * @returns {string} of evenly distributed directories
 */
function buildImgSubDirPath ( id, dirDepth = 2, symbolsPerSubDir = 3 )
{
  let subDirPath = '';
  const imgMd5Hash = md5( id );
  for ( let i = 0; i < dirDepth; i++ )
  {
    subDirPath += `${imgMd5Hash.substr( i * symbolsPerSubDir, symbolsPerSubDir  )}/`;
  }
  // Remove tailing slash
  subDirPath = subDirPath.substr( 0, subDirPath.length - 1 );

  return subDirPath;
}

module.exports = buildImgSubDirPath;
