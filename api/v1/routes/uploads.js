const express = require( 'express' );
// eslint-disable-next-line new-cap
const router = express.Router( { mergeParams: true } );
const Upload = require( '../../models/uploads' );
const asyncHandler = require( 'express-async-handler' );
const requireAuthentication = require( '../middleware/requireAuthentication' );
const sanitizeBody = require( '../middleware/sanitizeBody' );
const config = require( '../../../config' );

// For parsing multipart/form-data
const multer = require( 'multer' );
// For DoS protect purposes
const multerOpts = {
  limits: {
    fields: 0,
    fileSize: config.uploads.MAX_IMG_SIZE_BYTES,
    files: 1
  }
};
const upload = multer( multerOpts );

router.post( '/avatar', requireAuthentication, sanitizeBody, upload.single( 'avatar' ),
  asyncHandler( async ( req, res ) =>
  {
    await Upload.loadAvatarV1( req, res );

    res.status( 201 ).json( { avatarUrl: res.locals.avatarUrl } );

    Upload.removeOldAvatarV1( res );
  } ) );

module.exports = router;
