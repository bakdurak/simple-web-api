const express = require( 'express' );
const app = express();

const asyncHandler = require( 'express-async-handler' );
const sidRefresh = require( './v1/middleware/sidRefresh' );
const csrfProtect = require( './v1/middleware/csrfProtect' );

const v1 = require( './v1/routes/index' );

app.use( '/', csrfProtect );
app.use( '/', asyncHandler( sidRefresh ) );

app.use( '/v1', v1 );

module.exports = app;
