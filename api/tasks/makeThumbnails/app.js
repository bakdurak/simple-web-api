const pify = require( 'pify' );
let fs = require( 'fs' );
fs = pify( fs );
let mkdirp = require( 'mkdirp' );
mkdirp = pify( mkdirp );
const buildImgPath = require( '../../v1/utils/buildImgPath' );
const makeSharpTask = require( '../../v1/utils/makeSharpTask' );

let root;
let sizes;
let quality;
let saveTo;

let sharpTasks = [ ];
let mkdirpTasks = [ ];
let fsTasks = [ ];
// Use postfix for 'size' folder name to avoid name conflicts
const sizeFolderPostfix = `_${new Date().getTime()}`;
async function recursiveSearch ( subDirsPath = '/' )
{
  const dirContent = await fs.readdir( root + subDirsPath, { withFileTypes: true } );

  for ( let i = 0; i < dirContent.length; i++ )
  {
    if ( dirContent[ i ].isDirectory() )
    {
      await recursiveSearch( `${subDirsPath}${dirContent[ i ].name}/` );
    }

    if ( dirContent[ i ].isFile() )
    {
      // Process image by Sharp
      let imgBuff = await fs.readFile( root + subDirsPath + dirContent[ i ].name );
      for ( let j = 0; j < sizes.length ; j++ )
      {
        sharpTasks.push( makeSharpTask( imgBuff, sizes[ j ], quality ) );
      }
      // eslint-disable-next-line no-undef
      let imgBuffs = await Promise.all( sharpTasks );

      // Make subfolders for new images
      const imgId = dirContent[ i ].name.substr( 0,  dirContent[ i ].name.indexOf( '.' ) );
      const imgSubDirs = buildImgPath( imgId );
      for ( let j = 0; j < sizes.length ; j++ )
      {
        mkdirpTasks.push( mkdirp( `${saveTo}/${sizes[ j ]}${sizeFolderPostfix}/${imgSubDirs}` ) );
      }

      await Promise.all( mkdirpTasks );

      // Load images to FS
      for ( let j = 0; j < sizes.length; j++ )
      {
        // eslint-disable-next-line max-len
        fsTasks.push( fs.writeFile( `${saveTo}/${sizes[ j ]}${sizeFolderPostfix}/${imgSubDirs}/${imgId}.jpg`, imgBuffs[ j ] ) );
      }

      await Promise.all( fsTasks );

      // Free memory
      imgBuff = null;
      imgBuffs = [ ];
      sharpTasks = [ ];
      mkdirpTasks = [ ];
      fsTasks = [ ];
    }
  }
}

async function main ()
{
  root = process.argv[ 2 ];
  sizes = process.argv[ 3 ]
    .split( ',' )
    .map( Number );
  quality = Number( process.argv[ 4 ] );
  saveTo = process.argv[ 5 ];

  await recursiveSearch( );
}

module.exports = main;
