const mongoose = require( 'mongoose' );
const { Schema } = mongoose;
const prettyText = require( '../v1/utils/prettyText' );
const config = require( '../../config' );
const sanitizeObjByScheme = require( '../v1/utils/sanitizeObjByScheme' );
const eventFiltersSchema = require( '../v1/utils/filtersSchemes' ).event;
const toGeoSearch = require( '../v1/utils/toGeoSearch' );
const sessionWithRetry = require( '../v1/utils/sessionWithRetry' );
const User = require( './users' );
const BusinessRuleException = require( '../versionIndependentUtils/BusinessRuleException' );
const fromNumToGeoPoint = require( '../v1/utils/fromNumToGeoPoint' );
const qs = require( 'qs' );
const url = require( '../v1/utils/url' );


const subscriptionsSchema = new Schema(
  {
    role: {
      type: String,
      enum: [ 'fieldPlayers', 'goalkeepers' ],
      required: true
    },
    participant: {
      type: Schema.Types.ObjectId,
      ref: 'Users',
      required: true
    }
  },
  {
    timestamps: true
  }
);

const eventSchema = new Schema( {
  title: {
    type: String,
    minlength: 1,
    maxlength: 50,
    validate: prettyText.checkForManipulatorsExceptSpace,
    required: true
  },
  dateEventBegan: {
    type: Date,
    required: true
  },
  location: {
    type: {
      type: String,
      enum: [ 'Point' ],
      required: true
    },
    coordinates: {
      type: [ Number ],
      required: true
    }
  },
  userSubscriptions: [ subscriptionsSchema ],
  fieldPlayersCountMax: {
    type: Number,
    min: 4,
    max: 10,
    validate: {
      validator: Number.isInteger
    },
    required: true,
    default: 0
  },
  fieldPlayers: {
    type: [ {
      type: Schema.Types.ObjectId,
      ref: 'Users'
    } ]
  },
  fieldPlayersCnt: {
    type: Number,
    default: 0,
    required: true
  },
  goalkeepers: {
    type: [ {
      type: Schema.Types.ObjectId,
      ref: 'Users'
    } ]
  },
  goalkeepersCnt: {
    type: Number,
    default: 0,
    required: true
  },
  curMemberCnt: {
    type: Number,
    default: 1,
    required: true
  },
  host: {
    type: Schema.Types.ObjectId,
    ref: 'Users',
    required: true
  },
  minAge: {
    type: Number,
    min: 0,
    max: 100,
    validate: {
      validator: Number.isInteger
    },
    required: true
  },
  price: {
    type: Number,
    min: 0,
    max: 100000,
    validate: {
      validator: Number.isInteger
    },
    required: true
  },
  description: {
    type: String,
    minlength: 1,
    maxlength: 1000
  }
},
{
  timestamps: true
}
);

eventSchema.pre( 'updateOne', function ( next )
{
  this.options.runValidators = true;
  next();
} );

eventSchema.path( 'title' ).set( ( string ) =>
{
  if ( ! string ) throw new BusinessRuleException( 400, 'Empty event title' );
  const title = string.trim();
  return prettyText.prettyWords( title );
} );

eventSchema.statics.createV1 = async function ( req, res )
{
  const createEventCallback = async ( session ) =>
  {
    const eventBody = { title: req.body.title, dateEventBegan: req.body.dateEventBegan,
      location: fromNumToGeoPoint( req.body.location ),
      fieldPlayersCountMax: req.body.fieldPlayersCountMax,
      host: req.session.userId, minAge: req.body.minAge,
      price: req.body.price };

    let role;
    if ( req.body.role === 'goalkeepers' ) role = 'goalkeepers';
    else role = 'fieldPlayers';
    eventBody[ role ] = req.session.userId;
    eventBody[ `${role}Cnt` ] = 1;

    const event = new this( eventBody );

    // Brackets are necessary - [ event ]
    const createdEventId = ( await this.create( [ event ], { session } ) )
      [ 0 ]
      .id;
    // Save event id to send it back
    res.locals.createdEventId = createdEventId;

    // Insert recent created eventId into user's ownEvent array
    const userFilter = { _id: req.session.userId, $expr: { $lt: [ { $size: '$ownEvents' },
      config.event.MAX_CREATED_EVENTS_PER_USER ] } };
    const userUpdate = { $push: { ownEvents: createdEventId } };
    const userOpts = { session, projection: { _id: 1 } };
    // If update did not happen then roll back transaction
    // Likely reason: ownEvents is overfilled
    const userUpdateResult = await User.findOneAndUpdate( userFilter, userUpdate, userOpts );
    if ( ! userUpdateResult )
    {
      // Rollback
      throw new BusinessRuleException( 409, 'Count of created events is exceeded',
        config.errorLevels.info );
    }
  };

  await sessionWithRetry.runWholeTransactionWithRetry( createEventCallback );
};

eventSchema.statics.getByIdV1 = async function ( req, res )
{
  const event = await this.findOne( { _id: { $eq: req.params.id } } )
    .select( { userSubscriptions: 0, createdAt: 0, updatedAt: 0, __v: 0 } )
    .populate( { path: 'fieldPlayers', select: 'firstName secondName' } )
    .populate( { path: 'goalkeepers', select: 'firstName secondName' } );

  res.locals.event = event;
};

// There are two cases of input data:

// 1.Presence of 'feed' parameter tells us that user just did first query to events page without
// Any filters and order. ( first query )
// Also there are paired with 'feed' '_id' parameter ( afterId ). ( second and subsequent queries )

// 2.Any filter(s) or order parameters without '_id' and 'offset' parameters.
// ( first query with filter(s) or / and order )
// The same but with '_id' and 'offset' parameters.
// ( second and subsequent queries with filter(s) or / and order )
eventSchema.statics.findByFiltersV1 = async function ( req, res )
{
  let query = qs.parse( url.getRawQueryString( req.originalUrl ),
    { parameterLimit: config.common.MAX_QS_PARAM_CNT } );

  // Sanitize filters and convert geo conditions to db format if it exists
  try
  {
    const maxEventQueryDepth = 4;
    sanitizeObjByScheme( query, eventFiltersSchema, maxEventQueryDepth );

    if ( query.filters && query.filters.longitude && query.filters.latitude && query.filters.rad )
    {
      query.filters.location = toGeoSearch( query.filters.longitude, query.filters.latitude,
        query.filters.rad );
      delete query.filters.longitude;
      delete query.filters.latitude;
      delete query.filters.rad;
    }
  }
  catch ( error )
  {
    // Remove all properties and add property 'feed' to work with it as if 'feed' was passed
    // eslint-disable-next-line no-param-reassign
    query = { };
    query.feed = 1;
  }

  // Max count of 'order' params is 1, therefore if there are more than one, extract only first
  let order = { };
  if ( query.order )
  {
    const [ orderField ] = Object.keys( query.order );
    order[ orderField ] = query.order[ orderField ];
    if ( order[ orderField ] !== '1' && order[ orderField ] !== '-1' ) order = { };
  }

  // If parameter 'feed' is passed then set 'order' manually
  if ( query.feed ) order = { _id: -1 };

  // If it's the first query with filters / order
  // Then extract max current event 'id' to avoid 'offset / limit' duplications
  // Explanation of 'if' condition:
  // 1.If 'feed' is passed then 'beforeId' is not needed because 'feed' have not
  // 'offset / limit' duplications
  // 2.If there are '_id' or 'offset' parameters then that's definitely not first query
  // With filters / order
  // Therefore client already have 'beforeId' i.e. '_id' or 'offset' presence tells us
  // That is not first query
  const needBeforeId = ( ! ( query.feed )
    && ! ( ( query.filters && query.filters._id ) || query.offset ) );
  let beforeId;
  if ( needBeforeId )
  {
    beforeId = await this.findOne( { }, { _id: 1 } )
      .sort( { _id: -1 } )
      .limit( 1 );
  }

  // Extract one more to know are there items yet
  const areThereItemsYet = 1;
  const events = await this.find( query.filters
    ? query.filters
    : { } )
    .sort( order
      ? order
      : { } )
    .select( { fieldPlayers: 0, goalkeepers: 0, userSubscriptions: 0, createdAt: 0, updatedAt: 0,
      __v: 0 } )
    .populate( { path: 'host', select: 'firstName secondName' } )
    .skip( ( query.offset && query.offset <= config.event.EVENTS_MAX_OFFSET )
      ? Number( query.offset )
      : 0 )
    .limit( config.event.EVENT_PER_PAGE + areThereItemsYet );

  if ( needBeforeId ) res.locals.events = [ beforeId, events ];
  else res.locals.events = events;

  // Promise.all slower than sequential awaits
  // Await all
  // If( needBeforeId ) return await Promise.all([ beforeId, events ]);
  // Else return await events;
};

eventSchema.statics.createMemberV1 = async function ( req )
{
  const createMemberCallback = async ( session ) =>
  {
    // Criteria of creating member:
    // 1.Requestor is event host
    // 2.User.events[] is not overfilled
    // 3.User.eventsSubscriptions.containts(eventId) OR Event.userSubscriptions.contains(userId)
    // I.e. user has applied a bid
    // 4.Event.role.length < ( fieldPlayersCntMax or 2 if the role is goalkeeper )
    // 5.Role received by user has the same value as a role in database


    // Update the event
    const goalkeepersMaxCnt = 2;
    let eventFilter = null;
    let eventUpdate = null;
    if ( req.body.role === 'goalkeepers' )
    {
      eventFilter = {
        _id: req.params.id,
        'userSubscriptions.participant': req.body.uid,  // Clause 3
        host: req.session.userId,                       // Clause 1
        $expr: {                                        // Clause 4
          $lt: [ '$goalkeepersCnt', goalkeepersMaxCnt ]
        }
      };
      eventUpdate =  { $pull: { userSubscriptions: { participant: req.body.uid } },
        $push: { goalkeepers: req.body.uid },
        $inc: { curMemberCnt: 1, goalkeepersCnt: 1 }
      };
    }
    else
    {
      eventFilter = {
        _id: req.params.id,
        'userSubscriptions.participant': req.body.uid,  // Clause 3
        host: req.session.userId,                       // Clause 1
        $expr: {                                        // Clause 4
          $lt: [ '$fieldPlayersCnt', '$fieldPlayersCountMax' ]
        }
      };
      eventUpdate =  { $pull: { userSubscriptions: { participant: req.body.uid } },
        $push: { fieldPlayers: req.body.uid },
        $inc: { curMemberCnt: 1, fieldPlayersCnt: 1 }
      };
    }
    const eventOpts = { session, projection: { 'userSubscriptions.$': 1 } };
    const event = await this.findOneAndUpdate( eventFilter, eventUpdate, eventOpts );
    let roleDatabase;
    if ( event )
    {
      roleDatabase = event.userSubscriptions[ 0 ].role;
    }
    else
    {
      // Rollback
      throw new BusinessRuleException( 400, 'Goalkeepers or field players count is exceeded',
        config.errorLevels.info );
    }
    if ( roleDatabase !== req.body.role )                      // Clause 5
    {
      // Supplied role not equal database role
      // Possible reasons: role has changed, client error, malicious impact by user

      // Rollback
      throw new BusinessRuleException( 400, 'Passed role does not match database role',
        config.errorLevels.warn );
    }

    // Update User
    const userFilter = {
      _id: req.body.uid,
      $expr: { $lt: [ { $size: '$events' }, config.event.MAX_EVENT_PER_USER ] } // Clause 2
    };
    const userUpdate = { $pull: { eventSubscriptions: req.params.id },
      $push: { events: req.params.id } };
    const userOpts =  { session, projection: { _id: 1 } };
    const user = await User.findOneAndUpdate( userFilter, userUpdate, userOpts );
    if ( ! user )
    {
      // Rollback
      throw new BusinessRuleException( 409, 'Events per user exceeded', config.errorLevels.info );
    }
  };

  await sessionWithRetry.runWholeTransactionWithRetry( createMemberCallback );
};

eventSchema.statics.leaveMembersV1 = async function ( req )
{
  const leaveMembersCallback = async ( session ) =>
  {
    let eventFilter;
    const eventOpts = { session, projection: { _id: 1 } };
    let eventUpdate;
    // Host can't leave
    if ( req.body.role === 'goalkeepers' )
    {
      eventFilter = { _id: req.params.id, goalkeepers: req.session.userId,
        host: { $ne: req.session.userId }  };
      eventUpdate =  { $pull: { goalkeepers: req.session.userId  },
        $inc: { curMemberCnt: -1, goalkeepersCnt: -1 } };
    }
    else
    {
      eventFilter = { _id: req.params.id, fieldPlayers: req.session.userId,
        host: { $ne: req.session.userId }  };
      eventUpdate =  { $pull: { fieldPlayers: req.session.userId  },
        $inc: { curMemberCnt: -1, fieldPlayersCnt: -1 } };
    }
    const event = await this.findOneAndUpdate( eventFilter, eventUpdate, eventOpts );
    if ( ! event )
    {
      // Possible reasons: wrong role, host is leave target, player not found
      // Rollback
      throw new BusinessRuleException( 400, 'Passed role does not match database role',
        config.errorLevels.warn );
    }

    const userFilter = { _id: req.session.userId };
    const userUpdate = { $pull: { events: req.params.id } };
    await User.updateOne( userFilter, userUpdate, { session } );
  };

  await sessionWithRetry.runWholeTransactionWithRetry( leaveMembersCallback );
};

eventSchema.statics.kickMemberV1 = async function ( req )
{
  const kickMemberCallback = async ( session ) =>
  {
    // Host can't kick himself.
    // WARNING: Specially used '==' operator since on strict comparison
    // Intruder can pass such value that will not match with other
    // However being the same value.
    // Ex: string and number presentation of number
    if ( req.body.uid == req.session.userId )
    {
      throw new BusinessRuleException( 400, 'Host can\'t kick himself', config.errorLevels.warn );
    }

    let eventFilter;
    const eventOpts = { session, projection: { _id: 1 } };
    let eventUpdate;
    if ( req.body.role === 'goalkeepers' )
    {
      eventFilter = { _id: req.params.id, goalkeepers: req.body.uid, host: req.session.userId };
      eventUpdate =  { $pull: { goalkeepers: req.body.uid },
        $inc: { curMemberCnt: -1, goalkeepersCnt: -1 } };
    }
    else
    {
      eventFilter = { _id: req.params.id, fieldPlayers: req.body.uid, host: req.session.userId };
      eventUpdate =  { $pull: { fieldPlayers: req.body.uid },
        $inc: { curMemberCnt: -1, fieldPlayersCnt: -1 } };
    }
    const event = await this.findOneAndUpdate( eventFilter, eventUpdate, eventOpts );
    if ( ! event )
    {
      // Possible reasons: wrong role, requestor is not event host, player not found
      // Rollback
      throw new BusinessRuleException( 400, 'Player not found', config.errorLevels.info );
    }

    const userFilter = { _id: req.body.uid };
    const userUpdate = { $pull: { events: req.params.id } };
    await User.updateOne( userFilter, userUpdate, { session } );
  };

  await sessionWithRetry.runWholeTransactionWithRetry( kickMemberCallback );
};

eventSchema.statics.createSubscriptionV1 = async function  ( req )
{
  const createSubscriptionCallback = async ( session ) =>
  {
    let role;
    if ( req.body.role === 'goalkeepers' ) role = 'goalkeepers';
    else role = 'fieldPlayers';

    const eventFilter = { _id: req.params.id,
      // eslint-disable-next-line max-len
      $expr: { $lt: [ { $size: '$userSubscriptions' }, config.event.MAX_USER_PER_EVENT_SUBSCRIPTIONS_CNT ] },
      'userSubscriptions.participant': { $ne: req.session.userId },
      goalkeepers: { $ne: req.session.userId },
      fieldPlayers: { $ne: req.session.userId } };
    // eslint-disable-next-line max-len
    const eventUpdate =  { $push: { userSubscriptions: { role, participant: req.session.userId } } };
    const eventOpts = { session, projection: { _id: 1 } };

    const userFilter = {
      _id: req.session.userId,
      $expr: {
        $and: [
          // eslint-disable-next-line max-len
          { $lt: [ { $size: '$eventSubscriptions' }, config.event.MAX_EVENT_PER_USER_SUBSCRIPTIONS_CNT ] },
          { $lt: [ { $size: '$events' }, config.event.MAX_EVENT_PER_USER ] }
        ]
      }
    };
    const userUpdate = { $push: { eventSubscriptions: req.params.id } };
    const userOpts = eventOpts;

    const eventUpdateResult = await this.findOneAndUpdate( eventFilter, eventUpdate, eventOpts );
    if ( ! eventUpdateResult )
    {
      // Rollback
      throw new BusinessRuleException( 400, 'User subscriptions count per event is exceeded or ' +
        'user is already among participants', config.errorLevels.info );
    }

    const userUpdateResult = await User.findOneAndUpdate( userFilter, userUpdate, userOpts );
    if ( ! userUpdateResult )
    {
      // Rollback
      throw new BusinessRuleException( 400, 'User has exceeded membership or subscriptions count',
        config.errorLevels.info );
    }
  };

  await sessionWithRetry.runWholeTransactionWithRetry( createSubscriptionCallback );
};

eventSchema.statics.leaveSubscribersV1 = async function  ( req )
{
  const leaveSubscribersCallback = async ( session ) =>
  {
    const eventFilter = { _id: req.params.id };
    const eventUpdate =  { $pull: { userSubscriptions: { participant: req.session.userId } } };

    const userFilter = { _id: req.session.userId };
    const userUpdate = { $pull: { eventSubscriptions: req.params.id } };

    await this.updateOne( eventFilter, eventUpdate, { session } );
    await User.updateOne( userFilter, userUpdate, { session } );
  };

  await sessionWithRetry.runWholeTransactionWithRetry( leaveSubscribersCallback );
};

eventSchema.statics.kickSubscribersV1 = async function  ( req )
{
  const kickSubscribersCallback = async ( session ) =>
  {
    const eventFilter = { _id: req.params.id, host: req.session.userId };
    const eventUpdate =  { $pull: { userSubscriptions: { participant: req.body.uid } } };
    const eventOpts = { session, projection: { _id: 1 } };

    const userFilter = { _id: req.body.uid };
    const userUpdate = { $pull: { eventSubscriptions: req.params.id } };

    const isHost = await this.findOneAndUpdate( eventFilter, eventUpdate, eventOpts );
    if ( ! isHost )
    {
      // Rollback
      throw new BusinessRuleException( 400, 'Only host can kick', config.errorLevels.warn );
    }
    await User.updateOne( userFilter, userUpdate, { session } );
  };

  await sessionWithRetry.runWholeTransactionWithRetry( kickSubscribersCallback );
};

module.exports = mongoose.model( 'Events', eventSchema );
