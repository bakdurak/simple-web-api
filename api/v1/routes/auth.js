const express = require( 'express' );
// eslint-disable-next-line new-cap
const router = express.Router();
const User = require( '../../models/users' );
const asyncHandler = require( 'express-async-handler' );
const requireAuthentication = require( '../middleware/requireAuthentication' );

router.post( '/registration', asyncHandler( async ( req, res ) =>
{
  await User.createV1( req );

  await User.loginV1( req, res );

  res.status( res.locals.status ).json( { userId: res.locals.userId } );
} ) );

router.post( '/login', asyncHandler( async ( req, res ) =>
{
  await User.loginV1( req, res );

  res.status( res.locals.status ).json( { userId: res.locals.userId } );
} ) );

router.post( '/logout', requireAuthentication, asyncHandler( async ( req, res ) =>
{
  await User.logoutV1( req, res );

  res.status( res.locals.status ).end();
} ) );

module.exports = router;
