const mongoose = require( 'mongoose' );
require( 'dotenv' ).config();

module.exports = () =>
{
  return new Promise( ( resolve, reject ) =>
  {
    // Set up mongoose Promise
    mongoose.promise = global.Promise;

    if ( process.env.NODE_ENV === 'dev' )
    {
      // Dev option: log queries to mongo into console
      mongoose.set( 'debug', true );
    }

    mongoose.connection
      .on( 'error', ( error ) =>  reject( error )  )
      .on( 'close', () => console.log( 'Database connection is closed' ) )
      .once( 'open', () =>
      {
        resolve( mongoose.connections[ 0 ] );
      } );

    mongoose.connect( `${process.env.MONGO_URL}/${process.env.DB_NAME}`,
      { useNewUrlParser: true } );
  } );
};
