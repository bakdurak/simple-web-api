require( 'dotenv' ).config();
const mongoose = require( 'mongoose' );
const { Schema } = mongoose;
const config = require( '../../config' );
const emptyStubFunc = require( '../v1/utils/emptyStubFunction' );
const User = require( './users' );
const sessionWithRetry = require( '../v1/utils/sessionWithRetry' );
const buildImgSubDirPath = require( '../v1/utils/buildImgPath' );
const path = require( 'path' );
const createDirectories = require( '../v1/utils/createDirectories' );
const processImgsBySharp = require( '../v1/utils/processImgsBySharp' );
const saveImgsToFs = require( '../v1/utils/saveImgsToFs' );

// For platform independent remove files or directories
const rimraf = require( 'rimraf' );

const imgSizes = config.uploads.UPLOAD_PX_SIZES;
const root = process.env.UPLOAD_DIR;

/**
 * At the current time this {Mongoose.Schema} need just for keeping unique upload id
 */
const uploadSchema = new Schema(
  { },
  {
    timestamps: true
  }
);

uploadSchema.statics.loadAvatarV1 = async function  ( req, res )
{
  // First we process image to don't do it during transaction
  // Thereby reducing transaction time
  req.imgsBuff = await processImgsBySharp( req.file.buffer );

  const loadAvatarCallback = async ( session ) =>
  {
    // Create image and get it id
    const newImageId = ( await this.create( [ { } ], { session } ) )
      [ 0 ]
      .id;

    // Update user avatar
    let oldAvatarId = ( await User.findOneAndUpdate( { _id: req.session.userId },
      { $set: { avatar: newImageId }  },
      { session } ).select( { avatar: 1, _id: 0 } ) )
      .avatar;

    if ( ( oldAvatarId !== null ) && ( oldAvatarId !== undefined ) )
    {
      oldAvatarId = oldAvatarId.toString();

      // Remove old avatar id
      // Note: remove(), deleteOne() etc don't work with transactions
      // Because they don't have 'option' parameter to pass mongoose session
      await this.deleteMany( { _id: oldAvatarId },  { session } );
    }

    // Save images to FS
    const subDirsNewImg = buildImgSubDirPath( newImageId );
    await createDirectories( root, subDirsNewImg );
    await saveImgsToFs( req.imgsBuff, root, subDirsNewImg, newImageId );

    // Save avatar url to send it to user
    res.locals.avatarUrl = path.join( path.sep, 'static', config.uploads.UPLOADS_DIR,
      config.uploads.UPLOAD_PX_SIZES.extralarge.toString(), subDirsNewImg, `${newImageId}.jpg` );

    // Save oldAvatarId to remove old avatar
    res.locals.oldAvatarId = oldAvatarId;
  };

  await sessionWithRetry.runWholeTransactionWithRetry( loadAvatarCallback );
};

uploadSchema.statics.removeOldAvatarV1 = function ( res )
{
  // Remove old images
  if ( res.locals.oldAvatarId === null || res.locals.oldAvatarId === undefined ) return;
  // Note: we don't need to wait images removal
  // Because user only needs to get reference to new image
  const subDirsOldImg = buildImgSubDirPath( res.locals.oldAvatarId );
  let oldImgPath = '';
  // Remove original
  oldImgPath = path.join( root, config.uploads.DIR_FOR_STORE_ORIGINAL_IMGS, subDirsOldImg, `${res.locals.oldAvatarId}.jpg` );
  rimraf( oldImgPath, emptyStubFunc ) ;
  for ( const size in imgSizes )
  {
    oldImgPath = path.join( root, imgSizes[ size ].toString(), subDirsOldImg, `${res.locals.oldAvatarId}.jpg` );
    rimraf( oldImgPath, emptyStubFunc ) ;
  }
};

module.exports = mongoose.model( 'Uploads', uploadSchema );
