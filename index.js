const app = require( './app' );
const database = require( './database' );
require( 'dotenv' ).config();

database().then( ( info ) =>
{
  console.log( `Connected to ${info.host}:${info.port}/${info.name}` );
  app.listen( process.env.PORT, () => console.log( `Listening on ${process.env.PORT} port!` ) );
} )
  .catch( () =>
  {
    console.error( 'Unable to connect to database' );
    process.exit( 1 );
  } );

// For testing
module.exports = app;
