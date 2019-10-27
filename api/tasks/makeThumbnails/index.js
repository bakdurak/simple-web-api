const app = require( './app' );

app().then( ( someData ) =>
{
  if ( someData ) console.log( someData );
  process.exit( 1 );
} )
  .catch( ( err ) =>
  {
    console.log( err );
    process.exit( 1 );
  } );
