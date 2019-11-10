const User = require( '../../models/users' );
const bcrypt = require( 'bcrypt' );
const config = require( '../../../config' );

// eslint-disable-next-line prefer-arrow-callback
async function auth ( email, password, done )
{
  try
  {
    const user = await User.findOne( { email: { $eq: email } }, { email: 1, passwordHash: 1 } );
    const message = 'Such email does not exist or password is invalid';
    if ( ! user )
    {
      // Fake hashing
      // eslint-disable-next-line max-len
      const dummyHash = `$2b$${config.auth.HASH_ROUNDS}$JuAt.x5dHmm3pJwikCYBKuwEF.v1GAbDSUv9GhfhIrPG5D.tPZqei`;
      await bcrypt.compare( password, dummyHash );

      return done( null, false, { message } );
    }
    if ( ! await user.checkPasswordV1( password ) )
    {
      return done( null, false, { message } );
    }

    return done( null, user );
  }
  catch ( e )
  {
    return done( e );
  }
}

module.exports = auth;
