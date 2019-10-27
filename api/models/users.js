const mongoose = require( 'mongoose' );
const { Schema } = mongoose;
const bcrypt = require( 'bcrypt' );
const validator = require( 'validator' );
const prettyText = require( '../v1/utils/prettyText' );
const BusinessRuleException = require( '../versionIndependentUtils/BusinessRuleException' );
const passport = require( 'passport' );
const config = require( '../../config' );
const issueCsrfToken = require( '../v1/utils/issueCsrfToken' );

function checkName ( name )
{
  return ( prettyText.checkForManipulators( name )
    && ( validator.isAlpha( name, [ 'en-US' ] ) || validator.isAlpha( name, [ 'ru-RU' ] ) ) );
}

const userSchema = new Schema( {
  email: {
    type: String,
    required: true,
    unique: 'Such email already exists',
    lowercase: true,
    minlength: 4,
    maxlength: 50,
    trim: true,
    validate: validator.isEmail
  },
  passwordHash: {
    type: String,
    required: true
  },
  firstName: {
    type: String,
    required: true,
    minlength: 1,
    maxlength: 25,
    validate: checkName
  },
  secondName: {
    type: String,
    required: true,
    minlength: 1,
    maxlength: 25,
    validate: checkName
  },
  eventSubscriptions: {
    type: [ {
      type: Schema.Types.ObjectId,
      ref: 'Events'
    } ]
  },
  events: {
    type: [ {
      type: Schema.Types.ObjectId,
      ref: 'Events'
    } ]
  },
  ownEvents: {
    type: [ {
      type: Schema.Types.ObjectId,
      ref: 'Events'
    } ]
  },
  avatar: {
    type: Schema.Types.ObjectId,
    ref: 'Uploads',
  }
},
{
  timestamps: true
} );

userSchema.path( 'firstName' ).set( ( string ) =>
{
  if ( ! string ) throw new BusinessRuleException( 400, 'ValidationError' );
  string = string.trim();
  string = string.toLowerCase();

  return prettyText.capitalizeFirstLetter( string );
} );

userSchema.path( 'secondName' ).set( ( string ) =>
{
  if ( ! string ) throw new BusinessRuleException( 400, 'ValidationError' );
  string = string.trim();
  string = string.toLowerCase();

  return prettyText.capitalizeFirstLetter( string );
} );

userSchema.pre( 'updateOne', function ( next )
{
  this.options.runValidators = true;

  next();
} );

userSchema.statics.validatePasswordV1 = function ( req )
{
  const { password } = req.body;
  if ( ! password || ! validator.isLength( password, { min: 6, max: 20 } ) )
  {
    throw new BusinessRuleException( 401, 'Wrong password' );
  }
};

userSchema.statics.loginV1 = async function ( req, res )
{
  await new Promise( ( resolve ) =>
  {
    passport.authenticate( 'local', async ( err, user ) =>
    {
      if ( user === false )
      {
        res.status( 401 ).json( 'Login failed' );
      }
      else
      {
        await issueCsrfToken( res );

        // Protect against session fixation attack
        // If some user login from account A and then the same user login from account B
        // Then session id will be the same and only userId that relate to session will be changed.
        // Therefore it needs to check is whether user already logged.
        if ( req.session.userId )
        {
          // Create new SID
          req.session.regenerate( () =>
          {
            req.session.userId = user.id;
            req.session.createdAt = new Date();

            res.locals.status = 201;
            res.locals.userId = user.id;

            resolve( );
          } );
        }
        else
        {
          req.session.userId = user.id;
          req.session.createdAt = new Date();

          res.locals.status = 201;
          res.locals.userId = user.id;

          resolve( );
        }
      }
    } )( req );
  } );
};

userSchema.statics.logoutV1 = async function ( req, res )
{
  // Is user already authorized
  if ( req.session.userId )
  {
    return await new Promise( ( resolve ) =>
    {
      req.session.destroy( () =>
      {
        res.cookie( config.auth.SESSION_NAME, '', { expires: new Date( 0 ) } );

        res.locals.status = 200;

        resolve(  );
      } );
    } );
  }

  res.locals.status = 401;
};

userSchema.statics.createV1 = async function ( req )
{
  this.validatePasswordV1( req );

  try
  {
    const passwordHash = await bcrypt.hash( req.body.password, config.auth.HASH_ROUNDS );

    const user = new this( { email: req.body.email, passwordHash, firstName: req.body.firstName,
      secondName: req.body.secondName } );
    await this.create( user );
  }
  catch ( rawError )
  {
    const error = new BusinessRuleException();
    if ( rawError.code === 11000 )
    {
      error.message = 'Such email already exists';
      error.status = 409;
    }
    else
    {
      // Incorrect data format
      error.message = 'Validation error';
      error.status = 400;
    }

    throw error;
  }
};

userSchema.methods.checkPasswordV1 = async function ( password )
{
  if ( ! password ) return false;
  if ( ! this.passwordHash ) return false;

  return await bcrypt.compare( password, this.passwordHash );
};

module.exports = mongoose.model( 'Users', userSchema );
