require( 'dotenv' ).config();
const { MongoClient } = require( 'mongodb' );

// Connection URL
const url = process.env.MONGO_URL;

function connect ()
{
  return new Promise( ( ( resolve ) =>
  {
    const client =  resolve( MongoClient.connect( url, { useNewUrlParser: true } ) );
  } ) );
}

module.exports = connect;
