const express = require( 'express' );
// eslint-disable-next-line new-cap
const router = express.Router( { mergeParams: true } );
const asyncHandler = require( 'express-async-handler' );
const requireAuthentication = require( '../middleware/requireAuthentication' );
const sanitizeBody = require( '../middleware/sanitizeBody' );
const Event = require( '../../models/events' );

router.post( '/', requireAuthentication, asyncHandler( async ( req, res ) =>
{
  await Event.createSubscriptionV1( req );

  res.status( 201 ).end();
} ) );

router.delete( '/leave', requireAuthentication, asyncHandler( async ( req, res ) =>
{
  await Event.leaveSubscribersV1( req );

  res.status( 204 ).end();
} ) );

router.delete( '/kick', requireAuthentication, sanitizeBody, asyncHandler( async ( req, res ) =>
{
  await Event.kickSubscribersV1( req );

  res.status( 204 ).end();
} ) );

module.exports = router;
