require( 'dotenv' ).config();
const express = require( 'express' );
const app = express();
const path = require( 'path' );
const bodyParser = require( 'body-parser' );
const session = require( 'express-session' );
const cookieParser = require( 'cookie-parser' );
const mongoose = require( 'mongoose' );
const helmet = require( 'helmet' );
const config = require( './config' );
const passport = require( 'passport' );
const LocalStrategy = require( 'passport-local' );
const api = require( './api/index' );
const auth = require( './api/v1/middleware/auth' );
const errorHandler = require( './api/v1/middleware/errorHandler' );
const sanitizeHeaders = require( './api/v1/middleware/sanitiseHeaders' );

let MongoStore = require( 'connect-mongo' )( session );

// View engine setup
app.set( 'views', path.join( __dirname, 'views' ) );
app.set( 'view engine', 'ejs' );

// For parsing application/json
// { limit: '1kb' } - DoS protect
app.use( bodyParser.json( { limit: '1kb' } ) );
// For parsing application/x-www-form-urlencoded
app.use( bodyParser.urlencoded( { extended: true } ) );
app.use( cookieParser() );
app.use( helmet() );
// Disable some headers
app.use( sanitizeHeaders );

MongoStore = new MongoStore( {
  mongooseConnection: mongoose.connection,
  touchAfter: config.auth.TOUCH_AFTER,
  ttl: config.auth.SESSION_TTL
} );
app.use( session( {
  secret: process.env.SESSION_SECRET,
  cookie: {
    httpOnly: true,
    domain: process.env.DOMAIN_IP, // Local IP,
    sameSite: true
  },
  resave: false,
  saveUninitialized: false,
  name: config.auth.SESSION_NAME,
  store: MongoStore
} ) );

passport.use( new LocalStrategy( {
  usernameField: 'email',
  passwordField: 'password',
  session: false
}, auth ) );

app.use( passport.initialize() );

// SSR for polymorphic application could be here

app.use( '/api', api );

// Catch 404
// eslint-disable-next-line no-unused-vars
app.use( ( req, res, next ) =>
{
  res.status( 404 ).json( 'Nonexistent page' );
} );

// Error handler
app.use( errorHandler );

module.exports = app;
