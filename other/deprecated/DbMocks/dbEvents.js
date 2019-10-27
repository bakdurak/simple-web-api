const events = db.getCollection( 'events' );
const users = db.getCollection( 'users' );

function getRandomInt ( min, max )
{
  min = Math.ceil( min );
  max = Math.floor( max );
  return ( Math.floor( Math.random() *  ( max - min + 1 ) ) + min );
}

function randomStr ( length )
{
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

  for ( let i = 0; i < length; i++ )
  {
    text += possible.charAt( Math.floor( Math.random() * possible.length ) );
  }

  return text;
}

// ~~ 11.1 cm
const geoDataPrecision = 6;
// For geo data - latitude, longitude
function getRandomInRange ( from, to, fixed = geoDataPrecision )
{
  return ( ( Math.random() * ( to - from ) ) + from ).toFixed( fixed ) * 1;
  // .toFixed() returns string, so ' * 1' is a trick to convert to number
}

const goalkeepersMaxCnt = 2;
for ( let i = 0; i < 500000; i++ )
{
  // Set number of players
  const fieldPlayersCountMax = getRandomInt( 4, 10 );
  const curMemberCnt = getRandomInt( 1, fieldPlayersCountMax + goalkeepersMaxCnt );
  const randomMemberUsers = users.aggregate( [ { $sample: { size: curMemberCnt } },
    { $project: { _id: 1 } } ] );

  // Fill goalkeepers and field players
  const goalkeepers = [ ];
  const fieldPlayers = [ ];
  let isGoalkeeper;
  randomMemberUsers.forEach( ( doc ) =>
  {
    isGoalkeeper = false;
    if ( goalkeepers.length < goalkeepersMaxCnt )
    {
      isGoalkeeper = fieldPlayers.length < fieldPlayersCountMax ? getRandomInt( 0, 1 ) : 1;
      if ( isGoalkeeper )
      {
        goalkeepers.push( doc._id );
      }
      else
      {
        fieldPlayers.push( doc._id );
      }
    }
    else
    {
      fieldPlayers.push( doc._id );
    }
  } );

  // Set goalkeepers and fieldPlayers count
  const fieldPlayersCnt = fieldPlayers.length;
  const goalkeepersCnt = goalkeepers.length;

  // Set event host
  let host;
  if ( getRandomInt( 0, 1 ) && goalkeepers.length )
  {
    [ host ] = goalkeepers;
  }
  else
  {
    if ( fieldPlayers.length ) [ host ] = fieldPlayers;
    else [ host ] = goalkeepers;
  }

  // Set user subscriptions
  const userSubscriptionsCnt = getRandomInt( 0, 10 );
  const randomSubUsers = users.aggregate( [ { $sample: { size: userSubscriptionsCnt } },
    { $project: { _id: 1 } } ] );
  const userSubscriptions = [ ];
  randomSubUsers.forEach( ( doc ) =>
  {
    userSubscriptions.push( doc._id );
  } );

  // Set other
  const title = randomStr( getRandomInt( 1, 30 ) );
  const dateEventBegan = new Date();
  const location = { type: 'Point', coordinates: [  getRandomInRange( -180, 180 ),
    getRandomInRange( -90, 90 )  ] };
  const _price = getRandomInt( 300, 5000 );
  const price = _price - ( _price % 5 );
  const minAge = getRandomInt( 6, 25 );
  const description = randomStr( getRandomInt( 30, 600 ) );
  const createdAt = new Date();
  const updatedAt = new Date();
  const __v = NumberInt( 0 );

  // Add event
  events.insert( { fieldPlayersCountMax: NumberInt( fieldPlayersCountMax ), fieldPlayers,
    goalkeepers, title, dateEventBegan, location, host, price: NumberInt( price ),
    userSubscriptions, createdAt, updatedAt, __v, minAge: NumberInt( minAge ),
    curMemberCnt: NumberInt( curMemberCnt ), fieldPlayersCnt: NumberInt( fieldPlayersCnt ),
    goalkeepersCnt:  NumberInt( goalkeepersCnt ), description } );
}
