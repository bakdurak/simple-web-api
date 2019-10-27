const getRandomInRange = require( '../../api/v1/utils/getRandomInRange' );
const config = require( '../../config' );
const shuffleArray = require( '../utils/shuffleArray' );

function buildCondition ( filterField )
{
  // Special case for location
  if ( filterField.name === 'location' )
  {
    const geoPrecision = config.common.GEO_POINT_PRECISION;

    const longitude = getRandomInRange( -180, 180, geoPrecision );
    const latitude = getRandomInRange( -90, 90, geoPrecision );
    const center = Math.random().toFixed( geoPrecision ) * 1;

    return { $geoWithin: { $centerSphere: [ [ longitude, latitude ], center ] } };
  }

  // Possible conditions - eq, gte, lte, between
  const randCond = getRandomInRange( 0, 3, 0 );
  switch ( randCond )
  {
    case 0:
      return { $eq: getRandomInRange( filterField.from, filterField.to, 0 ) };
    case 1:
      return { $gte: getRandomInRange( filterField.from, filterField.to, 0 ) };
    case 2:
      return { $lte: getRandomInRange( filterField.from, filterField.to, 0 ) };
    case 3:
    {
      const gte = getRandomInRange( filterField.from, filterField.to, 0 );
      return { $gte: gte, $lte: getRandomInRange( gte, filterField.to, 0 ) };
    }
  }
}

function buildQuery ( offsetArg )
{
  // Filters
  // Define filter parameters
  // From, to - values ​​that a variable can take
  const filtersFields = [ { name: 'curMemberCnt', from: 1, to: 12 },
    { name: 'minAge', from: 6, to: 25 },
    { name: 'price', from: 300, to: 5000 },
    { name: 'location' } ];

  // Order
  // Define order parameters
  const orderFields = [ 'curMemberCnt', 'minAge', 'price' ];
  // Offset

  // Build filter
  // Set filter count
  const filterCnt = getRandomInRange( 1, filtersFields.length, 0 );
  // Shuffle array to choose random filters
  shuffleArray( filtersFields );
  // Pick random filters
  const filters = { };
  for ( let i = 0; i < filterCnt; i++ )
  {
    filters[ filtersFields[ i ].name ] = buildCondition( filtersFields[ i ] );
  }

  // Build sort
  // Suppose sort probability is 0.2
  const order = { };
  const sort = getRandomInRange( 0, 4, 0 );
  if ( sort === 0 )
  {
    shuffleArray( orderFields );
    order[ orderFields[ 0 ] ] = 1;
  }

  // Build offset
  const offset = offsetArg;

  return { filters, order, offset };
}

async function eventBenchmark ( db )
{
  const limit = 11;
  const queryCnt = 100;
  const events = db.collection( 'events' );
  let slowQueriesCnt = 0;
  let theLongestQuery = -1;
  let totalReqTimeMillis = 0;

  console.log( '---------------------------------------------------------------------' );
  for ( let i = 0; i <= queryCnt; i++ )
  {
    // Note: we have to use randomQuery from outer scope so change the variable type to 'var'
    // eslint-disable-next-line no-var
    var randomQuery = buildQuery( 50 );

    // Do query
    const explain = await events.find( randomQuery.filters )
      .sort( randomQuery.order )
      .skip( randomQuery.offset )
      .limit( limit )
      .explain();

    // Process 'explain' result
    totalReqTimeMillis += explain.executionStats.executionTimeMillis;

    if ( explain.executionStats.executionTimeMillis > 100 )
    {
      slowQueriesCnt += 1;

      process.stdout.write( 'Filters: ' );
      console.log( randomQuery.filters );
      process.stdout.write( 'Order: ' );
      console.log( randomQuery.order );
      console.log( `Offset: ${randomQuery.offset}` );
      console.log( `execution time millis: ${explain.executionStats.executionTimeMillis}` );
      console.log( `Iteration: ${i}` );
      console.log( '---------------------------------------------------------------------' );
    }

    if ( explain.executionStats.executionTimeMillis > theLongestQuery )
    {
      theLongestQuery = explain.executionStats.executionTimeMillis;
    }
  }

  // Print benchmark summary
  console.log( 'Summary: ' );
  console.log( `Total iterations: ${queryCnt}` );
  console.log( `Limit: ${limit}` );
  console.log( `Offset: ${randomQuery.offset}` );
  console.log( `Slow queries count: ${slowQueriesCnt}` );
  console.log( `The longest query: ${theLongestQuery}` );
  console.log( `Average request time millis: ${totalReqTimeMillis / queryCnt}` );
}

module.exports = eventBenchmark;
