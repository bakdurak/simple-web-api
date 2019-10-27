const express = require( 'express' );
const app = express();

const routeAuth = require( './auth' );
const routeUser = require( './users' );
const routeEvent = require( './events' );
const routeUploads = require( './uploads' );

app.use( '/auth', routeAuth );
app.use( '/users', routeUser );
app.use( '/events', routeEvent );
app.use( '/uploads', routeUploads );

module.exports = app;
