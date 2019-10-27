const getCookieByName = require( './getCookieByName' );
const config = require( '../../config' );

/**
 * Class intended for api testing to keep state between sequential queries to the api.
 */
class AppAgent
{
  constructor ( chai, app, creationUserUrl, creationUserBody, loginTitle )
  {
    this.chai = chai;
    this.app = app;
    this.creationUserUrl = creationUserUrl;
    this.creationUserBody = creationUserBody;
    this.loginTitle = loginTitle;
    this.curAuthKey = null;
    this.logged = null;
    this.csrfToken = null;
    this.entities = [ ];
    this.userData = [ ];
    this.dbModels = [ ];
    this.idxCurUser = 0;
    this.login = this.creationUserBody[ loginTitle ];
    this.creationAgentTimestamp = new Date().toISOString();
  }

  async privateCreateUser ()
  {
    // Add user serial number to avoid login duplications
    this.creationUserBody[ this.loginTitle ] = `${new Date().getTime()}_${this.login}`;
    const res = await this.chai.request( this.app )
      .post( this.creationUserUrl )
      .send( this.creationUserBody );
    if ( res.ok )
    {
      this.userData.push( { id: res.body.userId,
        authKey: getCookieByName( res, config.auth.SESSION_NAME ),
        email: this.creationUserBody[ this.loginTitle ],
        csrfToken: getCookieByName( res, config.auth.CSRF_COOKIE_NAME ),
        password: this.creationUserBody.password } );
      this.curAuthKey = this.userData[ this.userData.length - 1 ].authKey;
      this.idxCurUser = this.userData.length - 1;
      this.csrfToken = this.userData[ this.userData.length - 1 ].csrfToken;
    }

    return res;
  };

  async createEntityByApi ( url, body, modelTitle, entityIdTitle, howMany = 1 )
  {
    if ( ! this.entities[ url ] )
    {
      this.entities[ url ] = { modelTitle: null, entityIdTitle: null, entitiesData: [ ] };
    }
    this.entities[ url ].modelTitle = modelTitle;
    this.entities[ url ].entityIdTitle = entityIdTitle;
    if ( ! this.dbModels[ modelTitle ] )
    {
      this.dbModels[ modelTitle ] = require( `../../api/models/${modelTitle}` );
    }

    let res;
    const curResponses = [ ];
    for ( let i = 0; i < howMany; i++ )
    {
      res = await this.chai.request( this.app )
        .post( url )
        .send( body )
        .set( 'Cookie', this.logged ? this.curAuthKey : '' );
      if ( res.body )
      {
        this.entities[ url ].entitiesData.push( res.body );
        curResponses.push( res );
      }
    }

    return curResponses;
  }

  async removeAllEntitiesDirectly ()
  {
    // Remove all created entities
    for ( const url in this.entities )
    {
      const curModel = this.dbModels[ this.entities[ url ].modelTitle ];
      for ( let i = 0; i < this.entities[ url ].entitiesData.length; i++ )
      {
        const curEntityIdTitle = this.entities[ url ].entityIdTitle;
        const curEntityId = this.entities[ url ].entitiesData[ i ][ curEntityIdTitle ];

        // CreatedAt: { $gt: this.creationAgentTimestamp  } - For safety:
        // Not to accidentally delete  previously created db docs ( not created by this agent )
        await curModel.deleteOne( { _id: curEntityId,
          createdAt: { $gt: this.creationAgentTimestamp  } } );
      }
    }

    // Remove all users
    const Users = require( '../../api/models/users' );
    for ( let i = 0; i < this.userData.length; i++ )
    {
      await Users.deleteOne( { _id: this.userData[ i ].id,
        createdAt: { $gt: this.creationAgentTimestamp  } } );
    }
  }

  async createUserAndLogin ()
  {
    const res = await this.privateCreateUser();

    if ( res.ok ) this.logged = true;

    return res;
  }

  logout ()
  {
    this.logged = false;
  }

  loginAsCurUser ()
  {
    this.logged = true;
  }

  loginAsLastUser ()
  {
    this.logged = true;
    this.curAuthKey = this.userData[ this.userData.length - 1 ].authKey;
  }

  loginAsFirstUser ()
  {
    this.logged = true;
    this.curAuthKey = this.userData[ 0 ].authKey;
  }

  loginAsNthUser ( idx )
  {
    if ( ( idx >= 0 ) && ( idx <= ( this.userData.length - 1 ) ) )
    {
      this.logged = true;
      this.curAuthKey = this.userData[ idx ].authKey;
      this.idxCurUser = idx;
    }
    else console.log( 'Wrong user index' );
  }

  async loginAsCurUserWithSessRefresh ( loginUrl )
  {
    const res = await this.chai.request( this.app )
      .post( loginUrl )
      .send( { email: this.creationUserBody.email, password: this.creationUserBody.password } );
    if ( ! res.ok ) return null;
    const userPos = this.userData.map( ( e ) => e.id )
      .indexOf( res.body.userId );

    this.userData[ userPos ].authKey = getCookieByName( res, config.auth.SESSION_NAME );
    this.userData[ userPos ].csrfToken = getCookieByName( res, config.auth.CSRF_COOKIE_NAME );

    this.curAuthKey = this.userData[ this.userData.length - 1 ].authKey;
    this.csrfToken = this.userData[ this.userData.length - 1 ].csrfToken;
  }

  loginAsNextUser ()
  {
    if ( this.idxCurUser < ( this.userData.length - 1 ) )
    {
      this.idxCurUser += 1;
      this.curAuthKey = this.userData[ this.idxCurUser ].authKey;
      return true;
    }

    console.log( 'Unable to switch to next user' );
    return false;
  }

  loginAsPrevUser ()
  {
    if ( this.idxCurUser > 0 )
    {
      this.idxCurUser -= 1;
      this.curAuthKey = this.userData[ this.idxCurUser ].authKey;
      return true;
    }

    console.log( 'Unable to switch to previous user' );
    return false;
  }

  getCookiePayload ()
  {
    return ( `${this.curAuthKey};${this.csrfToken}` );
  }

  getCurUserId ()
  {
    return ( this.userData[ this.idxCurUser ].id );
  }

  getUserIdByIdx ( idx )
  {
    return ( this.userData[ idx ].id );
  }

  getUserCnt ()
  {
    return ( this.userData.length );
  }

  getCurAuthKey ()
  {
    return this.curAuthKey;
  }

  getCsrfToken ()
  {
    return ( this.csrfToken
      .split( '=' )
      [ 1 ]
    );
  }

  changeUserCredentials ( creationUserBody )
  {
    this.creationUserBody = creationUserBody;
  }

  getCurUserEmail ()
  {
    return ( this.userData[ this.userData.length - 1 ].email );
  }

  async doPostRequest ( url, body = { } )
  {
    return ( await this.chai.request( this.app )
      .post( url )
      .send( body )
      .set( 'Cookie', this.logged ? this.curAuthKey : '' ) );
  }

  async doDeleteRequest ( url, body = { } )
  {
    return ( await this.chai.request( this.app )
      .delete( url )
      .send( body )
      .set( 'Cookie', this.logged ? this.curAuthKey : '' ) );
  }
}

module.exports = AppAgent;
