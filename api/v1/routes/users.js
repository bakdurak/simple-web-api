const express = require( 'express' );
// eslint-disable-next-line new-cap
const router = express.Router();
const asyncHandler = require( 'express-async-handler' );
const Users = require( '../../models/users' );

router.get( '/:id', asyncHandler( async ( req, res ) =>
{
  const user = await Users.findOne( { _id: { $eq: req.params.id } } )
    .select( { email: 0, passwordHash: 0 } );

  res.json( user );
} ) );

module.exports = router;
