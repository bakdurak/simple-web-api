const express = require( 'express' );
// eslint-disable-next-line new-cap
const router = express.Router();
const asyncHandler = require( 'express-async-handler' );
const requireAuthentication = require( '../middleware/requireAuthentication' );
const Event = require( '../../models/events' );
const routerSubscribers = require( './subscribers' );
const routerMembers = require( './members' );

router.post( '/', requireAuthentication, asyncHandler( async ( req, res ) =>
{
  await Event.createV1( req, res );

  res.status( 201 ).json( { eventId: res.locals.createdEventId } );
} ) );


router.get( '/:id', asyncHandler( async ( req, res ) =>
{
  await Event.getByIdV1( req, res );

  res.json( res.locals.event );
} ) );

// Get by filters
router.get( '/', asyncHandler( async ( req, res ) =>
{
  await Event.findByFiltersV1( req, res );

  res.json( res.locals.events );
} ) );

router.use( '/:id/subscribers', routerSubscribers );
router.use( '/:id/members', routerMembers );

module.exports = router;
