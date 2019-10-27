const express = require( 'express' );
// eslint-disable-next-line new-cap
const router = express.Router( { mergeParams: true } );
const asyncHandler = require( 'express-async-handler' );
const requireAuthentication = require( '../middleware/requireAuthentication' );
const Event = require( '../../models/events' );
const sanitizeBody = require( '../middleware/sanitizeBody' );

router.post( '/', requireAuthentication, sanitizeBody, asyncHandler( async ( req, res ) =>
{
  await Event.createMemberV1( req );

  res.status( 201 ).end();
} ) );

router.delete( '/leave', requireAuthentication, asyncHandler( async ( req, res ) =>
{
  await Event.leaveMembersV1( req );

  res.status( 204 ).end();
} ) );


router.delete( '/kick', requireAuthentication, sanitizeBody, asyncHandler( async ( req, res ) =>
{
  await Event.kickMemberV1( req );

  res.status( 204 ).end();
} ) );

module.exports = router;
