const app = require( '../../../index' );
const expect = require( 'chai' ).expect;
const chaiHttp = require( 'chai-http' );
const chai = require( 'chai' );
const Users = require( '../../../api/models/users' );
const AppAgent = require( '../../utils/AppAgent' );
const config = require( '../../../config' );

chai.use( chaiHttp );

describe( 'Auth', () =>
{
  let appAgent;
  const creationUserUrl = '/api/v1/auth/registration';
  const creationUserBody = { email: 'test_api@mail.com', password: 'test_test', firstName: 'test',
    secondName: 'test' };
  let res;

  before( async () =>
  {
    appAgent =  new AppAgent( chai, app, creationUserUrl, creationUserBody, 'email' );
  } );

  describe( '/POST /registration', () =>
  {
    it( 'Should return 401 when password length is incorrect', async () =>
    {
      // Lower than 6 symbols
      creationUserBody.password = '12345';
      appAgent.changeUserCredentials( creationUserBody );
      res = await appAgent.createUserAndLogin();
      expect( res.status ).to.be.equal( 401 );

      // Greater than 20 symbols
      creationUserBody.password = '11111111111111111111111111111111111111111111';
      appAgent.changeUserCredentials( creationUserBody );
      res = await appAgent.createUserAndLogin();
      expect( res.status ).to.be.equal( 401 );
    } );

    it( 'Should create and authorize user when correct data is passed', async () =>
    {
      // Correct length
      creationUserBody.password = 'test_test';
      appAgent.changeUserCredentials( creationUserBody );
      res = await appAgent.createUserAndLogin();

      const lastUserId = ( await Users.findOne( { } )
        .sort( { _id: -1 } ) )
        .id;

      expect( res.status ).to.be.equal( 201 );
      expect( res.body ).to.be.an( 'object' );
      expect( lastUserId ).to.be.equal( res.body.userId );
    } );

    it( 'Should return 409 when email already exists', async () =>
    {
      const res = await chai.request( app )
        .post( creationUserUrl )
        .send( creationUserBody );
      expect( res.status ).to.be.equal( 409 );
    } );

    it( 'Should return 400 when incorrect email is passed', async () =>
    {
      await appAgent.removeAllEntitiesDirectly();

      creationUserBody.email = 'wrong-email';
      const res = await chai.request( app )
        .post( creationUserUrl )
        .send( creationUserBody );
      expect( res.status ).to.be.equal( 400 );
    } );

    after( async () =>
    {
      await appAgent.removeAllEntitiesDirectly();
    } );
  } );

  describe( '/POST /login', () =>
  {
    const loginUrl = '/api/v1/auth/login';
    const correctLoginBody = { email: 'test_api@mail.com', password: 'test_test' };

    before( async () =>
    {
      creationUserBody.email = correctLoginBody.email;
      creationUserBody.password = correctLoginBody.password;
      appAgent =  new AppAgent( chai, app, creationUserUrl, creationUserBody, 'email' );
      res = await appAgent.createUserAndLogin();
      correctLoginBody.email = appAgent.getCurUserEmail();
    } );

    it( 'Should return 401 when email or password is incorrect', async () =>
    {
      const payloadWithNonexistentEmail = Object.assign( { }, correctLoginBody );
      payloadWithNonexistentEmail.email = 'abc12345@mail.com';
      let res = await chai.request( app )
        .post( loginUrl )
        .send( payloadWithNonexistentEmail );
      expect( res.status ).to.be.equal( 401 );

      const payloadWithWrongPassword = Object.assign( { }, correctLoginBody );
      payloadWithWrongPassword.password = '12345678';
      res = await chai.request( app )
        .post( loginUrl )
        .send( payloadWithWrongPassword );
      expect( res.status ).to.be.equal( 401 );
    } );

    it( 'Should authorize user when correct data is passed', async () =>
    {
      const res = await chai.request( app )
        .post( loginUrl )
        .send( correctLoginBody );

      const lastUserId = ( await Users.findOne( { } )
        .sort( { _id: -1 } ) )
        .id;

      expect( res.status ).to.be.equal( 201 );
      expect( res.body ).to.be.an( 'object' );
      expect( lastUserId ).to.be.equal( res.body.userId );
    } );

    after( async () =>
    {
      await appAgent.removeAllEntitiesDirectly();
    } );
  } );

  describe( '/POST /logout', () =>
  {
    const logoutUrl = '/api/v1/auth/logout';
    let authKey;

    before( async () =>
    {
      appAgent =  new AppAgent( chai, app, creationUserUrl, creationUserBody, 'email' );
      await appAgent.createUserAndLogin();
      authKey = appAgent.getCurAuthKey();
    } );

    it( 'Should return 419 during logout when wrong csrf token is passed', async () =>
    {
      const wrongCsrf = '12345';
      const res = await chai.request( app )
        .post( logoutUrl )
        .set( 'Cookie', appAgent.getCookiePayload() )
        .set( config.auth.CSRF_HEADER_NAME,  wrongCsrf );
      expect( res.status ).to.equal( 419 );
    } );

    it( 'Should logout user when valid csrf token is passed', async () =>
    {
      await appAgent.loginAsCurUserWithSessRefresh( '/api/v1/auth/login' );

      const res = await chai.request( app )
        .post( logoutUrl )
        .set( 'Cookie', appAgent.getCookiePayload() )
        .set( config.auth.CSRF_HEADER_NAME,  appAgent.getCsrfToken() );
      expect( res.status ).to.equal( 200 );
    } );

    it( 'Should return 401 when user is not authorized', async () =>
    {
      const res = await chai.request( app )
        .post( logoutUrl )
        .set( 'Cookie', authKey );
      expect( res.status ).to.equal( 401 );
    } );

    after( async () =>
    {
      await appAgent.removeAllEntitiesDirectly();
    } );
  } );
} );
