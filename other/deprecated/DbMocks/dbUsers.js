const users = db.getCollection( 'users' );

function getRandomInt ( min, max )
{
  min = Math.ceil( min );
  max = Math.floor( max );
  return ( Math.floor( Math.random() * ( max - min + 1 ) ) + min );
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

for ( let i = 0; i < 1000000; i++ )
{
  const email = `${randomStr( getRandomInt( 5, 15 ) )}@mail.com`;
  const passwordHash = randomStr( 60 );
  const firstName = randomStr( getRandomInt( 5, 15 ) );
  const secondName = randomStr( getRandomInt( 8, 18 ) );

  users.insert( { eventSubscriptions: [ ], events: [ ], ownEvents: [ ], email, passwordHash,
    firstName, secondName, createdAt: new Date(), updatedAt: new Date(), __v: NumberInt( 0 ) } );
}
