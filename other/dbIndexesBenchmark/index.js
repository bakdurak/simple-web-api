require( 'dotenv' ).config();
const database = require( './database' );
// Database Name
const dbName = process.env.DB_NAME;
const eventBenchmark = require( './eventBecnhmark' );

// Note: benchmarks execute without database warm up
database()
  .then(  async ( client ) =>
  {
    // Connect to concrete database by it's name
    if ( ! client )
    {
      console.error( 'Unable to connect to database' );
      process.exit( 1 );
    }
    const dbInterface = { };
    dbInterface.db = client.db( dbName );
    dbInterface.client = client;
    console.log( 'Successfully connected to database' );

    // Execute benchmarks
    await eventBenchmark( dbInterface.db );
    dbInterface.client.close();
  } )
  .catch( () =>
  {
    console.error( 'Unable to connect to database' );
    process.exit( 1 );
  } );
