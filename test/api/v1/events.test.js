const app = require( '../../../index' );
const expect = require( 'chai' ).expect;
const chaiHttp = require( 'chai-http' );
const chai = require( 'chai' );
const Event = require( '../../../api/models/events' );
const Users = require( '../../../api/models/users' );
const config = require( '../../../config' );
const xor = require( '../../../api/v1/utils/xor' );
const mochaFailTest = require( '../../../api/v1/utils/chaiFailTest' );
const AppAgent = require( '../../utils/AppAgent' );

chai.use( chaiHttp );

describe( 'Events', () =>
{
  describe( '/POST event', () =>
  {
    let appAgent;
    const creationEventBody = {
      title: 'Test API',
      dateEventBegan: '2018-11-10T16:29:16.924Z',
      location: [
        -16.713907999999,
        -120.33600277777777777
      ],
      fieldPlayersCountMax: '8',
      minAge: '15',
      price: '500',
      role: 'fieldPlayers'
    };
    const creationUserUrl = '/api/v1/auth/registration';
    const creationUserBody = { email: 'test_api@mail.com', password: 'test_test', firstName: 'test',
      secondName: 'test' };
    const creationEventUrl = '/api/v1/events';
    let res;
    let hostId;
    before( async () =>
    {
      appAgent =  new AppAgent( chai, app, creationUserUrl, creationUserBody, 'email' );

      // Create host
      await appAgent.createUserAndLogin();

      hostId = appAgent.getCurUserId();
    } );

    it( 'Should return 401 while posting event without authorization', async () =>
    {
      appAgent.logout();
      res = ( await appAgent.createEntityByApi( creationEventUrl, creationEventBody, 'events',
        'eventId' ) )
        [ 0 ];
      expect( res.status ).to.equal( 401 );
    } );

    it( 'Should return 201 on post event with authorization', async () =>
    {
      appAgent.loginAsLastUser();
      res = ( await appAgent.createEntityByApi( creationEventUrl, creationEventBody, 'events',
        'eventId' ) )
        [ 0 ];
      expect( res.status ).to.equal( 201 );
    } );

    it( 'After insert an event both user.ownEvents and events should contain 1 element', async () =>
    {
      const ownEventsLength = ( await Users.findOne( { _id: hostId } ) ).ownEvents.length;
      expect( ownEventsLength ).to.equal( 1 );

      const eventsCntBelongsUser = ( await Event.find( { host: hostId } ) ).length;
      expect( eventsCntBelongsUser ).to.equal( 1 );
    } );

    it( 'Host is goalkeeper (xor)or field player', async () =>
    {
      const event = await Event.findOne( { host: hostId } );

      const goalkeeper = event.goalkeepers[ 0 ];
      const fieldPlayer = event.fieldPlayers[ 0 ];
      if ( ! xor( goalkeeper, fieldPlayer ) )
      {
        mochaFailTest( expect );
      }
    } );

    it( 'FieldPlayersCnt must be equal to 1 if host is an field player ' +
      'and vice verca if the host is goalkeeper goalkeepersCnt must be 1', async () =>
    {
      const event = await Event.findOne( { host: hostId } );

      const fieldPlayers = event.fieldPlayers[ 0 ];
      const goalkeepers = event.goalkeepers[ 0 ];
      const fieldPlayersCnt = event.fieldPlayersCnt;
      const goalkeepersCnt = event.goalkeepersCnt;
      if ( fieldPlayers )
      {
        if ( ! fieldPlayersCnt ) mochaFailTest( expect );
      }
      if ( goalkeepers )
      {
        if ( ! goalkeepersCnt ) mochaFailTest( expect );
      }
    } );

    it( 'User can have no more than MAX_CREATED_EVENTS_PER_USER events', async () =>
    {
      const alreadyEventsExist = 1;
      const maxEventsPerUser = config.event.MAX_CREATED_EVENTS_PER_USER - alreadyEventsExist;
      appAgent.loginAsLastUser();
      for ( let i = 0; i < maxEventsPerUser; i++ )
      {
        // Await createEvent(event, authCookie, 201);
        res = ( await appAgent.createEntityByApi( creationEventUrl, creationEventBody, 'events',
          'eventId' ) )
          [ 0 ];
        expect( res.status ).to.equal( 201 );
      }

      // Await createEvent(event, authCookie, 409);
      res = ( await appAgent.createEntityByApi( creationEventUrl, creationEventBody, 'events',
        'eventId' ) )
        [ 0 ];
      expect( res.status ).to.equal( 409 );
    } );

    after( async () =>
    {
      await appAgent.removeAllEntitiesDirectly();
    } );
  } );

  describe( '/GET events', () =>
  {
    function compareEventsById ( firstEvents, secondEvents )
    {
      // Compare id's of directly received event and through an api
      for ( let i = 0; i < firstEvents.length ; i++ )
      {
        expect( firstEvents[ i ].id ).to.equal( secondEvents[ i ]._id );
      }
    }

    const queryRepeatCnt = 50;
    const areThereItemsYet = 1;

    describe( 'Get events feed', () =>
    {
      let afterId;

      it( 'Should return latest set of events when feed parameter is passed', async () =>
      {
        // Get latest event set directly
        // Extract one more to know are there items yet
        const areThereItemsYet = 1;
        const latestEvents = await Event.find( {  } )
          .sort( { _id: -1 } )
          .limit( config.event.EVENT_PER_PAGE + areThereItemsYet );

        // Get latest event set through an api
        const res = await chai.request( app )
          .get( '/api/v1/events' )
          .query( '[feed]=1' );

        compareEventsById( latestEvents, res.body );

        // Save afterId for next tests
        afterId = res.body[ res.body.length - 1 - areThereItemsYet ]._id;
      } );

      it( 'Should return next ( after previous events set ) events set when feed ' +
        'and _id parameters are passed ( repeatedly )', async () =>
      {
        for ( let i = 1; i <= queryRepeatCnt; i++ )
        {
          // Get next event set directly
          // Extract one more to know are there items yet
          const nextEvents = await Event.find( {  } )
            .sort( { _id: -1 } )
            .skip( config.event.EVENT_PER_PAGE * i )
            .limit( config.event.EVENT_PER_PAGE + areThereItemsYet );

          // Get latest event set through an api
          const res = await chai.request( app )
            .get( '/api/v1/events' )
            .query( '[feed]=1' )
            .query( `[filters][_id][$lt]=${afterId}` );

          compareEventsById( nextEvents, res.body );

          // Save afterId for next queries
          afterId = res.body[ res.body.length - 1 - areThereItemsYet ]._id;
        }
      } );
    } );

    describe( 'Get events by filters', () =>
    {
      let beforeIdDirect;

      before( async () =>
      {
        // Get beforeId directly
        beforeIdDirect = ( await Event.findOne( { }, { _id: 1 } )
          .sort( { _id: -1 } )
          .limit( 1 ) )
          .id;
      } );

      it( 'Should return set of events and beforeId value when any filter is passed without _id ' +
        'and offset parameters', async () =>
      {
        // Get events by some filter directly
        const curMemberCntFilter = 7;
        const priceFilter = 2860;
        const directEvents = await Event.find( { curMemberCnt: { $gt: curMemberCntFilter },
          price: { $lt: priceFilter } } )
          .limit( config.event.EVENT_PER_PAGE + areThereItemsYet );

        // Get events by the same filter using api
        const res = await chai.request( app )
          .get( '/api/v1/events' )
          .query( `[filters][curMemberCnt][$gt]=${curMemberCntFilter}` )
          .query( `[filters][price][$lt]=${priceFilter}` );

        // Compare events
        compareEventsById( directEvents, res.body[ 1 ] );

        // Compare beforeId parameter
        expect( beforeIdDirect ).to.equal( res.body[ 0 ]._id );
      } );

      it( 'Should return set of events and beforeId value when any order is passed without _id ' +
        'and offset parameters', async () =>
      {
        // Get events by some order directly
        const priceOrder = -1;
        const directEvents = await Event.find( { } )
          .sort( { price: priceOrder } )
          .limit( config.event.EVENT_PER_PAGE + areThereItemsYet );

        // Get events by the same filter using api
        const res = await chai.request( app )
          .get( '/api/v1/events' )
          .query( `[order][price]=${priceOrder}` );

        // Compare events
        compareEventsById( directEvents, res.body[ 1 ] );

        // Compare beforeId parameter
        expect( beforeIdDirect ).to.equal( res.body[ 0 ]._id );
      } );

      it( 'Should return next set of events when any filter and _id, ' +
        'offset parameters are passed ( repeatedly )', async () =>
      {
        for ( let i = 1; i <= queryRepeatCnt; i++ )
        {
          // Get events by some filter directly
          const curMemberCntFilter = 7;
          const priceFilter = 2860;
          const directEvents = await Event.find( { curMemberCnt: { $gt: curMemberCntFilter },
            price: { $lt: priceFilter } } )
            .skip( config.event.EVENT_PER_PAGE * i )
            .limit( config.event.EVENT_PER_PAGE + areThereItemsYet );

          // Get events by the same filter using api
          const res = await chai.request( app )
            .get( '/api/v1/events' )
            .query( `[filters][curMemberCnt][$gt]=${curMemberCntFilter}` )
            .query( `[filters][price][$lt]=${priceFilter}` )
            .query( `[filters][_id][$lt]=${beforeIdDirect}` )
            .query( `[offset]=${config.event.EVENT_PER_PAGE * i}` );

          // Compare events
          compareEventsById( directEvents, res.body );
        }
      } );

      it( 'Should return next set of events when any order and _id, offset parameters ' +
        'are passed ( repeatedly )', async () =>
      {
        for ( let i = 1; i <= queryRepeatCnt; i++ )
        {
          // Get events by some filter directly
          const priceOrder = -1;
          const directEvents = await Event.find( { } )
            .sort( { price: priceOrder } )
            .skip( config.event.EVENT_PER_PAGE * i )
            .limit( config.event.EVENT_PER_PAGE + areThereItemsYet );

          // Get events by the same filter using api
          const res = await chai.request( app )
            .get( '/api/v1/events' )
            .query( `[order][price]=${priceOrder}` )
            .query( `[filters][_id][$lt]=${beforeIdDirect}` )
            .query( `[offset]=${config.event.EVENT_PER_PAGE * i}` );

          // Compare events
          compareEventsById( directEvents, res.body );
        }
      } );
    } );
  } );

  describe( '/:id/subscribers', () =>
  {
    describe( '/POST /', () =>
    {
      let appAgent;
      let eventId;
      const creationEventBody = {
        title: 'Test API',
        dateEventBegan: '2018-11-10T16:29:16.924Z',
        location: [
          -16.713907999999,
          -120.33600277777777777
        ],
        fieldPlayersCountMax: '8',
        minAge: '15',
        price: '500',
        role: 'fieldPlayers'
      };
      const eventHostIdx = 0;
      const creationEventUrl = '/api/v1/events';
      before( async () =>
      {
        // Create agent and user associated with it
        const creationUserUrl = '/api/v1/auth/registration';
        const creationUserBody = { email: 'test_api@mail.com', password: 'test_test',
          firstName: 'test', secondName: 'test' };
        appAgent =  new AppAgent( chai, app, creationUserUrl, creationUserBody, 'email' );
        await appAgent.createUserAndLogin();

        // Create event
        eventId = ( await appAgent.createEntityByApi( creationEventUrl, creationEventBody, 'events',
          'eventId' ) )
          [ 0 ].body.eventId;
      } );

      it( 'Should return 401 while posting subscription to event without authorization', async () =>
      {
        appAgent.logout();

        const url = `/api/v1/events/${eventId}/subscribers`;
        const subscriberRole = { role: 'goalkeepers' };
        const res = await appAgent.doPostRequest( url, subscriberRole );
        expect( res.status ).to.equal( 401 );
      } );

      it( 'Should return 201 while posting subscription to event with authorization', async () =>
      {
        // Create new user so we can subscribe to event ( host can't do this )
        await appAgent.createUserAndLogin();

        const subscribeUrl = `/api/v1/events/${eventId}/subscribers`;
        const subscriberRole = { role: 'goalkeepers' };
        const res = await appAgent.doPostRequest( subscribeUrl, subscriberRole );
        expect( res.status ).to.equal( 201 );

        // Leave from this event to correctly continue test
        const leaveUrl = `/api/v1/events/${eventId}/subscribers/leave`;
        await appAgent.doDeleteRequest( leaveUrl );
      } );

      it( 'Should return 400 while sending non-existent event id', async () =>
      {
        const fakeEventId = '111111111111111111111111';
        const url = `/api/v1/events/${fakeEventId}/subscribers`;
        const subscriberRole = { role: 'goalkeepers' };
        const res = await appAgent.doPostRequest( url, subscriberRole );
        expect( res.status ).to.equal( 400 );
      } );

      it( 'Should return 400 while subscription count per event is exceeded', async () =>
      {
        // Fill up event subscriber
        const subscriberRole = { role: 'goalkeepers' };
        const subscribeUrl = `/api/v1/events/${eventId}/subscribers`;
        for ( let i = 0; i < config.event.MAX_USER_PER_EVENT_SUBSCRIPTIONS_CNT; i++ )
        {
          await appAgent.createUserAndLogin();
          const res = await appAgent.doPostRequest( subscribeUrl, subscriberRole );
          expect( res.status ).to.equal( 201 );
        }

        // Try to add extra user
        await appAgent.createUserAndLogin();
        const res = await appAgent.doPostRequest( subscribeUrl, subscriberRole );
        expect( res.status ).to.equal( 400 );

        // Leave from subscribers by each user
        const leaveUrl = `/api/v1/events/${eventId}/subscribers/leave`;
        for ( let i = 0; i < config.event.MAX_USER_PER_EVENT_SUBSCRIPTIONS_CNT; i++ )
        {
          appAgent.loginAsPrevUser();
          await appAgent.doDeleteRequest( leaveUrl );
        }
      } );

      it( 'Should return 400 when subscriber is host', async () =>
      {
        appAgent.loginAsNthUser( eventHostIdx );
        const subscribeUrl = `/api/v1/events/${eventId}/subscribers`;
        const subscriberRole = { role: 'goalkeepers' };
        const res = await appAgent.doPostRequest( subscribeUrl, subscriberRole );
        expect( res.status ).to.equal( 400 );
      } );

      it( 'Should return 400 when subscriber is among event members', async () =>
      {
        let res;

        // Switch to any user ( except host ) to subscribe ( host can't do it )
        const subscriberIdx = eventHostIdx + 1;
        appAgent.loginAsNthUser( subscriberIdx );
        const subscriberId = appAgent.getCurUserId();
        const subscriberRole = { role: 'goalkeepers' };
        const subscribeUrl = `/api/v1/events/${eventId}/subscribers`;
        await appAgent.doPostRequest( subscribeUrl, subscriberRole );

        // Login as host to add new subscriber to members
        appAgent.loginAsNthUser( eventHostIdx );
        const addMemberUrl = `/api/v1/events/${eventId}/members`;
        const addMemberBody = { uid: subscriberId, role: 'goalkeepers' };
        await appAgent.doPostRequest( addMemberUrl, addMemberBody );

        // Switch back to subscriber to try to subscribe
        appAgent.loginAsNthUser( subscriberIdx );
        res = await appAgent.doPostRequest( subscribeUrl, subscriberRole );
        expect( res.status ).to.equal( 400 );

        // Clear member to test further
        appAgent.loginAsNthUser( eventHostIdx );
        const kickMemberUrl = `/api/v1/events/${eventId}/members/kick`;
        const kickMemberBody = { uid: subscriberId, role: 'goalkeepers' };
        await appAgent.doDeleteRequest( kickMemberUrl, kickMemberBody );


        // Do the same but with 'fieldPlayers' role
        // Switch back to subscriber and subscribe as field player
        appAgent.loginAsNthUser( subscriberIdx );
        subscriberRole.role = 'fieldPlayers';
        await appAgent.doPostRequest( subscribeUrl, subscriberRole );

        // Login as host to add new subscriber to members
        appAgent.loginAsNthUser( eventHostIdx );
        addMemberBody.role = 'fieldPlayers';
        await appAgent.doPostRequest( addMemberUrl, addMemberBody );

        // Switch back to subscriber to try to subscribe
        appAgent.loginAsNthUser( subscriberIdx );
        res = await appAgent.doPostRequest( subscribeUrl, subscriberRole );
        expect( res.status ).to.equal( 400 );

        // Clear member to test further
        appAgent.loginAsNthUser( eventHostIdx );
        kickMemberBody.role = 'fieldPlayers';
        await appAgent.doDeleteRequest( kickMemberUrl, kickMemberBody );
      } );

      it( 'Should return 400 when subscriber is already among subscribers', async () =>
      {
        // Login as some user
        appAgent.loginAsNthUser( eventHostIdx + 1 );

        // Subscribe
        const subscribeUrl = `/api/v1/events/${eventId}/subscribers`;
        const subscriberRole = { role: 'goalkeepers' };
        let res = await appAgent.doPostRequest( subscribeUrl, subscriberRole );
        expect( res.status ).to.equal( 201 );

        // Try to subscribe one more time
        res = await appAgent.doPostRequest( subscribeUrl, subscriberRole );
        expect( res.status ).to.equal( 400 );

        // Leave from event to test further
        const leaveUrl = `/api/v1/events/${eventId}/subscribers/leave`;
        await appAgent.doDeleteRequest( leaveUrl );
      } );

      it( 'Should return 400 when subscription cnt per user is exceeded', async () =>
      {
        const eventIds = [ ];
        const subscriberRole = { role: 'goalkeepers' };
        const someUserIdx = eventHostIdx + 1;
        let res;
        for ( let i = 0; i < config.event.MAX_EVENT_PER_USER_SUBSCRIPTIONS_CNT; i++ )
        {
          // Create event
          await appAgent.createUserAndLogin();
          eventIds.push( ( await appAgent.createEntityByApi( creationEventUrl, creationEventBody,
            'events', 'eventId' ) )
            [ 0 ]
            .body
            .eventId );

          // Subscribe to new event
          appAgent.loginAsNthUser( someUserIdx );
          res = await appAgent.doPostRequest(
            `/api/v1/events/${eventIds[ eventIds.length - 1 ]}/subscribers`, subscriberRole
          );
          expect( res.status ).to.equal( 201 );
        }

        // Create event
        let extraEventId;
        await appAgent.createUserAndLogin();
        // eslint-disable-next-line prefer-const
        extraEventId = ( await appAgent.createEntityByApi( creationEventUrl, creationEventBody,
          'events', 'eventId' ) )
          [ 0 ]
          .body
          .eventId;

        // Subscribe to one more event to exceed MAX_EVENT_PER_USER_SUBSCRIPTIONS_CNT
        appAgent.loginAsNthUser( someUserIdx );
        res = await appAgent.doPostRequest( `/api/v1/events/${extraEventId}/subscribers`, subscriberRole );
        expect( res.status ).to.equal( 400 );

        // Leave from events to continue test further
        for ( let i = 0; i < eventIds.length; i++ )
        {
          await appAgent.doDeleteRequest( `/api/v1/events/${eventIds[ i ]}/subscribers/leave` );
        }
      } );

      it( 'Should return 400 when user try to subscribe with exceeded event own membership',
        async () =>
        {
          // Create new user to create events
          await appAgent.createUserAndLogin();

          const curEventIds = [ ];
          const subscriberRole = { role: 'fieldPlayers' };
          const someUserIdx = eventHostIdx + 1;
          const addMemberBody = { uid: appAgent.getUserIdByIdx( someUserIdx ),
            role: 'fieldPlayers' };
          let res;
          for ( let i = 0; i < config.event.MAX_EVENT_PER_USER; i++ )
          {
            // Create event by host
            appAgent.loginAsLastUser();
            curEventIds.push( ( await appAgent.createEntityByApi( creationEventUrl,
              creationEventBody, 'events', 'eventId' ) )
              [ 0 ]
              .body.eventId );

            // Subscribe to new event by someUser
            appAgent.loginAsNthUser( someUserIdx );
            res = await appAgent.doPostRequest( `/api/v1/events/${curEventIds[ i ]}/subscribers`,
              subscriberRole );
            expect( res.status ).to.equal( 201 );

            // Add to members by host ( login as host )
            appAgent.loginAsLastUser();
            await appAgent.doPostRequest( `/api/v1/events/${curEventIds[ i ]}/members`, addMemberBody );
          }

          // Create event by host
          appAgent.loginAsLastUser();
          const extraEventId = ( await appAgent.createEntityByApi( creationEventUrl,
            creationEventBody, 'events',
            'eventId' ) )
            [ 0 ].body.eventId;

          // Try subscribe to new event by someUser with exceeded own membership count
          appAgent.loginAsNthUser( someUserIdx );
          res = await appAgent.doPostRequest( `/api/v1/events/${extraEventId}/subscribers`,
            subscriberRole );
          expect( res.status ).to.equal( 400 );

          // Leave from events to continue test further
          appAgent.loginAsNthUser( someUserIdx );
          for ( let i = 0; i < curEventIds.length; i++ )
          {
            await appAgent.doDeleteRequest( `/api/v1/events/${curEventIds[ i ]}/members/leave`,
              subscriberRole );
          }
        } );

      it( 'After apply a bid event.userSubscriptions.role should have corresponding passed role ' +
        '( goalkeeper or field player )', async () =>
      {
        // Create new user to create event
        await appAgent.createUserAndLogin();

        // Create event
        let someEventId = ( await appAgent.createEntityByApi( creationEventUrl, creationEventBody,
          'events', 'eventId' ) )
          [ 0 ]
          .body.eventId;

        // Subscribe to event by subscriber
        let res;
        const someUserIdx = 1;
        const subscriberRole = { role: 'goalkeepers' };
        appAgent.loginAsNthUser( someUserIdx );
        res = await appAgent.doPostRequest( `/api/v1/events/${someEventId}/subscribers`, subscriberRole );
        expect( res.status ).to.equal( 201 );

        // Check db for role directly ( goalkeeper )
        let createdEvent = await Event.findOne( { _id: someEventId } );
        expect( createdEvent.userSubscriptions[ 0 ].role ).to.equal( subscriberRole.role );

        // Leave subscribers
        await appAgent.doDeleteRequest( `/api/v1/events/${someEventId}/subscribers/leave` );

        // Do the same with field player
        // Create event
        appAgent.loginAsLastUser();
        someEventId = ( await appAgent.createEntityByApi( creationEventUrl, creationEventBody,
          'events', 'eventId' ) )
          [ 0 ]
          .body.eventId;

        // Subscribe to event by subscriber
        subscriberRole.role = 'fieldPlayers';
        appAgent.loginAsNthUser( someUserIdx );
        res = await appAgent.doPostRequest( `/api/v1/events/${someEventId}/subscribers`, subscriberRole );
        expect( res.status ).to.equal( 201 );

        // Check db for role directly ( fieldPlayers )
        createdEvent = await Event.findOne( { _id: someEventId } );
        expect( createdEvent.userSubscriptions[ 0 ].role ).to.equal( subscriberRole.role );

        // Leave subscribers
        await appAgent.doDeleteRequest( `/api/v1/events/${someEventId}/subscribers/leave` );
      } );

      it( 'After apply a bid event.userSubscriptions.participant should have corresponding user id',
        async () =>
        {
          // Create new user to create event
          await appAgent.createUserAndLogin();

          // Create event
          const someEventId = ( await appAgent.createEntityByApi( creationEventUrl,
            creationEventBody, 'events', 'eventId' ) )
            [ 0 ]
            .body.eventId;

          // Subscribe to event by subscriber
          let res;
          const someUserIdx = 1;
          const subscriberRole = { role: 'goalkeepers' };
          appAgent.loginAsNthUser( someUserIdx );
          // eslint-disable-next-line prefer-const
          res = await appAgent.doPostRequest( `/api/v1/events/${someEventId}/subscribers`,
            subscriberRole );
          expect( res.status ).to.equal( 201 );

          const subscriberId = appAgent.getUserIdByIdx( someUserIdx );
          const createdEvent = await Event.findOne( { _id: someEventId } );
          expect( subscriberId ).to.equal(
            createdEvent.userSubscriptions[ 0 ].participant.toString()
          );

          // Leave subscribers
          await appAgent.doDeleteRequest( `/api/v1/events/${someEventId}/subscribers/leave` );
        } );

      it( 'After apply a bid user.eventSubscriptions should have corresponding event id',
        async () =>
        {
          // Create new user to create event
          await appAgent.createUserAndLogin();

          // Create event
          const someEventId = ( await appAgent.createEntityByApi( creationEventUrl,
            creationEventBody, 'events', 'eventId' ) )
            [ 0 ]
            .body.eventId;

          // Subscribe to event by subscriber
          let res;
          const someUserIdx = 1;
          const subscriberRole = { role: 'goalkeepers' };
          appAgent.loginAsNthUser( someUserIdx );
          // eslint-disable-next-line prefer-const
          res = await appAgent.doPostRequest( `/api/v1/events/${someEventId}/subscribers`,
            subscriberRole );
          expect( res.status ).to.equal( 201 );

          const subscriberId = appAgent.getUserIdByIdx( someUserIdx );
          const subscriber = await Users.findOne( { _id: subscriberId } );
          expect( subscriber.eventSubscriptions[ 0 ].toString() ).to.equal( someEventId );

          // Leave subscribers
          await appAgent.doDeleteRequest( `/api/v1/events/${someEventId}/subscribers/leave` );
        } );

      after( async () =>
      {
        await appAgent.removeAllEntitiesDirectly();
      } );
    } );

    describe( '/DELETE /leave', () =>
    {
      let appAgent;
      let eventId;
      const creationEventBody = {
        title: 'Test API',
        dateEventBegan: '2018-11-10T16:29:16.924Z',
        location: [
          -16.713907999999,
          -120.33600277777777777
        ],
        fieldPlayersCountMax: '8',
        minAge: '15',
        price: '500',
        role: 'fieldPlayers'
      };
      let subscriberId;
      const creationUserUrl = '/api/v1/auth/registration';
      const creationUserBody = { email: 'test_api@mail.com', password: 'test_test',
        firstName: 'test', secondName: 'test' };
      const creationEventUrl = '/api/v1/events';
      let res;
      const subscriberRole = { role: 'goalkeepers' };
      before( async () =>
      {
        appAgent =  new AppAgent( chai, app, creationUserUrl, creationUserBody, 'email' );

        // Create host
        await appAgent.createUserAndLogin();

        // Create event by host
        eventId = ( await appAgent.createEntityByApi( creationEventUrl, creationEventBody,
          'events', 'eventId' ) )
          [ 0 ]
          .body.eventId;

        // Create test subscriber
        await appAgent.createUserAndLogin();
        const subscriberIdx = 1;
        subscriberId = appAgent.getUserIdByIdx( subscriberIdx );
      } );

      it( 'Should return 204 when subscriber leave event', async () =>
      {
        // Subscribe to event
        res = await appAgent.doPostRequest( `/api/v1/events/${eventId}/subscribers`, subscriberRole );
        expect( res.status ).to.equal( 201 );

        // Leave event subscribers
        res = await appAgent.doDeleteRequest( `/api/v1/events/${eventId}/subscribers/leave` );
        expect( res.status ).to.equal( 204 );
      } );


      it( 'After leave subscribers event.userSubscriptions must not contain user id', async () =>
      {
        // Subscribe to event
        res = await appAgent.doPostRequest( `/api/v1/events/${eventId}/subscribers`, subscriberRole );
        expect( res.status ).to.equal( 201 );

        // Leave event subscribers
        await appAgent.doDeleteRequest( `/api/v1/events/${eventId}/subscribers/leave` );

        // Check db
        const event = await Event.findOne( { _id: eventId,
          'userSubscriptions.participant': subscriberId } );
        expect( event ).to.be.null;
      } );

      it( 'After leave subscribers user.eventSubscriptions must not contain event id', async () =>
      {
        // Subscribe to event
        res = await appAgent.doPostRequest( `/api/v1/events/${eventId}/subscribers`, subscriberRole );
        expect( res.status ).to.equal( 201 );

        // Leave event subscribers
        await appAgent.doDeleteRequest( `/api/v1/events/${eventId}/subscribers/leave` );

        // Check db
        const user = await Users.findOne( { _id: subscriberId, eventSubscriptions: eventId } );
        expect( user ).to.be.null;
      } );

      after( async () =>
      {
        await appAgent.removeAllEntitiesDirectly();
      } );
    } );

    describe( '/DELETE /kick', () =>
    {
      let appAgent;
      let eventId;
      const creationEventBody = {
        title: 'Test API',
        dateEventBegan: '2018-11-10T16:29:16.924Z',
        location: [
          -16.713907999999,
          -120.33600277777777777
        ],
        fieldPlayersCountMax: '8',
        minAge: '15',
        price: '500',
        role: 'fieldPlayers'
      };
      let subscriberId;
      const creationUserUrl = '/api/v1/auth/registration';
      const creationUserBody = { email: 'test_api@mail.com', password: 'test_test',
        firstName: 'test', secondName: 'test' };
      const creationEventUrl = '/api/v1/events';
      let res;
      const subscriberRole = { role: 'goalkeepers' };
      const hostIdx = 0;
      const subscriberIdx = 1;
      before( async () =>
      {
        appAgent =  new AppAgent( chai, app, creationUserUrl, creationUserBody, 'email' );

        // Create host
        await appAgent.createUserAndLogin();

        // Create event by host
        eventId = ( await appAgent.createEntityByApi( creationEventUrl, creationEventBody,
          'events', 'eventId' ) )
          [ 0 ]
          .body.eventId;

        // Create test subscriber
        await appAgent.createUserAndLogin();
        subscriberId = appAgent.getUserIdByIdx( subscriberIdx );
      } );


      it( 'Should return 204 when host kick some subscriber', async () =>
      {
        // Login as subscriber and subscribe
        appAgent.loginAsNthUser( subscriberIdx );
        res = await appAgent.doPostRequest( `/api/v1/events/${eventId}/subscribers`, subscriberRole );
        expect( res.status ).to.equal( 201 );

        // Login as host and kick
        const kickUserUrl = `/api/v1/events/${eventId}/subscribers/kick`;
        const kickUserBody = { uid: subscriberId };
        appAgent.loginAsNthUser( hostIdx );
        res = await appAgent.doDeleteRequest( kickUserUrl, kickUserBody );
        expect( res.status ).to.be.equal( 204 );
      } );

      it( 'Should return 400 when someone other try to kick some subscriber', async () =>
      {
        // Login as subscriber and subscribe
        appAgent.loginAsNthUser( subscriberIdx );
        res = await appAgent.doPostRequest( `/api/v1/events/${eventId}/subscribers`, subscriberRole );
        expect( res.status ).to.equal( 201 );

        // Create new malicious user and try to kick someone
        await appAgent.createUserAndLogin();
        const kickUserUrl = `/api/v1/events/${eventId}/subscribers/kick`;
        const kickUserBody = { uid: subscriberId };
        res = await appAgent.doDeleteRequest( kickUserUrl, kickUserBody );
        expect( res.status ).to.be.equal( 400 );

        // Leave subscribers to test further
        appAgent.loginAsNthUser( subscriberIdx );
        await appAgent.doDeleteRequest( `/api/v1/events/${eventId}/subscribers/leave` );
      } );

      it( 'After kick subscribers event.userSubscriptions must not contain user id', async () =>
      {
        // Subscribe to event
        appAgent.loginAsNthUser( subscriberIdx );
        res = await appAgent.doPostRequest( `/api/v1/events/${eventId}/subscribers`, subscriberRole );
        expect( res.status ).to.equal( 201 );

        // Leave event subscribers
        await appAgent.doDeleteRequest( `/api/v1/events/${eventId}/subscribers/leave` );

        // Check db
        const event = await Event.findOne( { _id: eventId,
          'userSubscriptions.participant': subscriberId } );
        expect( event ).to.be.null;
      } );

      it( 'After leave subscribers user.eventSubscriptions must not contain event id', async () =>
      {
        // Subscribe to event
        appAgent.loginAsNthUser( subscriberIdx );
        res = await appAgent.doPostRequest( `/api/v1/events/${eventId}/subscribers`, subscriberRole );
        expect( res.status ).to.equal( 201 );

        // Leave event subscribers
        await appAgent.doDeleteRequest( `/api/v1/events/${eventId}/subscribers/leave` );

        // Check db
        const user = await Users.findOne( { _id: subscriberId, eventSubscriptions: eventId } );
        expect( user ).to.be.null;
      } );

      after( async () =>
      {
        await appAgent.removeAllEntitiesDirectly();
      } );
    } );
  } );

  describe( '/:id/members', () =>
  {
    describe( '/POST /', () =>
    {
      let appAgent;
      let eventId;
      const creationEventBody = {
        title: 'Test API',
        dateEventBegan: '2018-11-10T16:29:16.924Z',
        location: [
          -16.713907999999,
          -120.33600277777777777
        ],
        fieldPlayersCountMax: '8',
        minAge: '15',
        price: '500',
        role: 'fieldPlayers'
      };
      let memberId;
      const creationUserUrl = '/api/v1/auth/registration';
      const creationUserBody = { email: 'test_api@mail.com', password: 'test_test',
        firstName: 'test', secondName: 'test' };
      const creationEventUrl = '/api/v1/events';
      let res;
      const subscriberRole = { role: 'goalkeepers' };
      const testMemberIdx = 1;
      const hostIdx = 0;
      const addMemberBody = { };
      before( async () =>
      {
        appAgent =  new AppAgent( chai, app, creationUserUrl, creationUserBody, 'email' );

        // Create host
        await appAgent.createUserAndLogin();

        // Create event by host
        eventId = ( await appAgent.createEntityByApi( creationEventUrl, creationEventBody,
          'events', 'eventId' ) )
          [ 0 ]
          .body.eventId;

        // Create test subscriber
        await appAgent.createUserAndLogin();
        memberId = appAgent.getUserIdByIdx( testMemberIdx );
        addMemberBody.uid = memberId;
        addMemberBody.role = 'fieldPlayers';
      } );

      it( 'Should return 401 while posting event member without authorization', async () =>
      {
        // Login as member and add to event subscribers
        appAgent.loginAsNthUser( testMemberIdx );
        res = await appAgent.doPostRequest( `/api/v1/events/${eventId}/subscribers`, subscriberRole );
        expect( res.status ).to.equal( 201 );

        // Logout and try to add to event member
        appAgent.logout();
        res = await appAgent.doPostRequest( `/api/v1/events/${eventId}/members`, addMemberBody );
        expect( res.status ).to.equal( 401 );

        // Login as testMember and leave to test further
        appAgent.loginAsNthUser( testMemberIdx );
        res = await appAgent.doDeleteRequest( `/api/v1/events/${eventId}/subscribers/leave` );
        expect( res.status ).to.equal( 204 );
      } );

      it( 'Should return 201 while posting event member with authorization ' +
        '( goalkeeper & fieldPlayer )', async () =>
      {
        // Login as testMember and subscribe as goalkeeper
        appAgent.loginAsNthUser( testMemberIdx );
        subscriberRole.role = 'goalkeepers';
        res = await appAgent.doPostRequest( `/api/v1/events/${eventId}/subscribers`, subscriberRole );
        expect( res.status ).to.equal( 201 );

        // Login as host and add to event member goalkeeper
        appAgent.loginAsNthUser( hostIdx );
        addMemberBody.role = 'goalkeepers';
        res = await appAgent.doPostRequest( `/api/v1/events/${eventId}/members`, addMemberBody );
        expect( res.status ).to.equal( 201 );

        // Kick testMember
        const kickMemberBody = addMemberBody;
        res = await appAgent.doDeleteRequest( `/api/v1/events/${eventId}/members/kick`, kickMemberBody );
        expect( res.status ).to.equal( 204 );

        // Login as testMember and subscribe as fieldPlayer
        appAgent.loginAsNthUser( testMemberIdx );
        subscriberRole.role = 'fieldPlayers';
        res = await appAgent.doPostRequest( `/api/v1/events/${eventId}/subscribers`, subscriberRole );
        expect( res.status ).to.equal( 201 );

        // Login as host and add to event member fieldPlayer
        appAgent.loginAsNthUser( hostIdx );
        addMemberBody.role = 'fieldPlayers';
        res = await appAgent.doPostRequest( `/api/v1/events/${eventId}/members`, addMemberBody );
        expect( res.status ).to.equal( 201 );

        // Kick testMember to test further
        res = await appAgent.doDeleteRequest( `/api/v1/events/${eventId}/members/kick`, kickMemberBody );
        expect( res.status ).to.equal( 204 );
      } );

      it( 'Should return 400 if test user is not among userSubscriptions.participant ' +
        '( goalkeeper & fieldPlayer )', async () =>
      {
        // Login as host
        appAgent.loginAsNthUser( hostIdx );

        // Try to add testMember as goalkeeper
        addMemberBody.role = 'goalkeepers';
        res = await appAgent.doPostRequest( `/api/v1/events/${eventId}/members`, addMemberBody );
        expect( res.status ).to.equal( 400 );

        // Try to add testMember as fieldPlayer
        addMemberBody.role = 'fieldPlayers';
        res = await appAgent.doPostRequest( `/api/v1/events/${eventId}/members`, addMemberBody );
        expect( res.status ).to.equal( 400 );
      } );

      it( 'Should return 400 if user knocking to the endpoint is not event host ' +
        '( goalkeeper & fieldPlayer )', async () =>
      {
        // Login as testMember and subscribe as goalkeeper
        appAgent.loginAsNthUser( testMemberIdx );
        subscriberRole.role = 'goalkeepers';
        res = await appAgent.doPostRequest( `/api/v1/events/${eventId}/subscribers`, subscriberRole );
        expect( res.status ).to.equal( 201 );

        // Create malicious user to try to add testMember as goalkeeper
        await appAgent.createUserAndLogin();
        const maliciousUserIdx = appAgent.getUserCnt() - 1;
        addMemberBody.role = 'goalkeepers';
        res = await appAgent.doPostRequest( `/api/v1/events/${eventId}/members`, addMemberBody );
        expect( res.status ).to.equal( 400 );

        // Login as testMember and leave event
        appAgent.loginAsNthUser( testMemberIdx );
        res = await appAgent.doDeleteRequest( `/api/v1/events/${eventId}/subscribers/leave` );
        expect( res.status ).to.equal( 204 );

        // Subscribe to event as fieldPlayer
        subscriberRole.role = 'fieldPlayers';
        res = await appAgent.doPostRequest( `/api/v1/events/${eventId}/subscribers`, subscriberRole );
        expect( res.status ).to.equal( 201 );

        // Login as malicious user and try to add testMember as fieldPlayer
        appAgent.loginAsNthUser( maliciousUserIdx );
        addMemberBody.role = 'fieldPlayers';
        res = await appAgent.doPostRequest( `/api/v1/events/${eventId}/members`, addMemberBody );
        expect( res.status ).to.equal( 400 );

        // Login as testMember and leave event to test further
        appAgent.loginAsNthUser( testMemberIdx );
        res = await appAgent.doDeleteRequest( `/api/v1/events/${eventId}/subscribers/leave` );
        expect( res.status ).to.equal( 204 );
      } );

      it( 'Should return 400 when goalkeepersCnt is exceeded', async () =>
      {
        const goalkeepersCnt = 2;
        const goalkeepersIds = [ ];
        subscriberRole.role = 'goalkeepers';
        addMemberBody.role = 'goalkeepers';
        for ( let i = 0; i < goalkeepersCnt; i++ )
        {
          // Create user and save him id
          await appAgent.createUserAndLogin();
          goalkeepersIds.push( appAgent.getCurUserId() );

          // Subscribe to event as goalkeeper
          res = await appAgent.doPostRequest( `/api/v1/events/${eventId}/subscribers`, subscriberRole );
          expect( res.status ).to.equal( 201 );

          // Login as event host and add testMember as goalkeeper
          appAgent.loginAsNthUser( hostIdx );
          addMemberBody.uid = goalkeepersIds[ goalkeepersIds.length - 1 ];
          res = await appAgent.doPostRequest( `/api/v1/events/${eventId}/members`, addMemberBody );
          expect( res.status ).to.equal( 201 );
        }

        // Create extra goalkeeper and subscribe
        await appAgent.createUserAndLogin();
        goalkeepersIds.push( appAgent.getCurUserId() );
        res = await appAgent.doPostRequest( `/api/v1/events/${eventId}/subscribers`, subscriberRole );
        expect( res.status ).to.equal( 201 );

        // Refresh addMember body to new goalkeeper id
        addMemberBody.uid = appAgent.getCurUserId();

        // Login as event host and try to add extra testMember as goalkeeper
        appAgent.loginAsNthUser( hostIdx );
        res = await appAgent.doPostRequest( `/api/v1/events/${eventId}/members`, addMemberBody );
        expect( res.status ).to.equal( 400 );

        // Kick both goalkeepers to test further
        for ( let i = 0; i < goalkeepersCnt; i++ )
        {
          const kickMemberBody = { uid: goalkeepersIds[ i ], role: 'goalkeepers' };
          res = await appAgent.doDeleteRequest( `/api/v1/events/${eventId}/members/kick`, kickMemberBody );
          expect( res.status ).to.equal( 204 );
        }

        // Leave as extra goalkeeper to test further
        appAgent.loginAsLastUser();
        res = await appAgent.doDeleteRequest( `/api/v1/events/${eventId}/subscribers/leave` );
        expect( res.status ).to.equal( 204 );

        // Set addMemberBody.uid to testMember id
        addMemberBody.uid = appAgent.getUserIdByIdx( testMemberIdx );
      } );

      it( 'Should return 400 when fieldPlayersCnt is greater than fieldPlayersCountMax', async () =>
      {
        const fieldPlayersMaxCnt = Number( creationEventBody.fieldPlayersCountMax );
        const fieldPlayersIds = [ ];
        subscriberRole.role = 'fieldPlayers';
        addMemberBody.role = 'fieldPlayers';
        const hostIsFieldPlayer = ( creationEventBody.role === 'fieldPlayers' ) ? 1 : 0;

        for ( let i = 0; i < fieldPlayersMaxCnt - hostIsFieldPlayer; i++ )
        {
          // Create user
          await appAgent.createUserAndLogin();
          fieldPlayersIds.push( appAgent.getCurUserId() );

          // Subscribe to event as fieldPlayer
          res = await appAgent.doPostRequest( `/api/v1/events/${eventId}/subscribers`, subscriberRole );
          expect( res.status ).to.equal( 201 );

          // Login as event host and add fieldPlayer
          appAgent.loginAsNthUser( hostIdx );
          addMemberBody.uid = fieldPlayersIds[ fieldPlayersIds.length - 1 ];
          res = await appAgent.doPostRequest( `/api/v1/events/${eventId}/members`, addMemberBody );
          expect( res.status ).to.equal( 201 );
        }

        // Create extra fieldPlayer and subscribe
        await appAgent.createUserAndLogin();
        res = await appAgent.doPostRequest( `/api/v1/events/${eventId}/subscribers`, subscriberRole );
        expect( res.status ).to.equal( 201 );

        // Refresh addMember body to new fieldPlayer id
        addMemberBody.uid = appAgent.getCurUserId();

        // Login as event host and try to add extra fieldPlayer
        appAgent.loginAsNthUser( hostIdx );
        res = await appAgent.doPostRequest( `/api/v1/events/${eventId}/members`, addMemberBody );
        expect( res.status ).to.equal( 400 );

        // Login as event host and kick all fieldPlayers to test further
        for ( let i = 0; i < fieldPlayersIds.length; i++ )
        {
          const kickMemberBody = { uid: fieldPlayersIds[ i ], role: 'fieldPlayers' };
          res = await appAgent.doDeleteRequest( `/api/v1/events/${eventId}/members/kick`, kickMemberBody );
          expect( res.status ).to.equal( 204 );
        }

        // Leave as extra fieldPlayer to test further
        appAgent.loginAsLastUser();
        res = await appAgent.doDeleteRequest( `/api/v1/events/${eventId}/subscribers/leave` );
        expect( res.status ).to.equal( 204 );

        // Set addMemberBody.uid to testMember id
        addMemberBody.uid = appAgent.getUserIdByIdx( testMemberIdx );
      } );

      it( 'Should return 400 when supplied role does not fit database role', async () =>
      {
        // Login as testMember and subscribe to event as goalkeeper
        appAgent.loginAsNthUser( testMemberIdx );
        subscriberRole.role = 'goalkeepers';
        res = await appAgent.doPostRequest( `/api/v1/events/${eventId}/subscribers`, subscriberRole );
        expect( res.status ).to.equal( 201 );

        // Login as event host and try to add testMember as fieldPlayer
        appAgent.loginAsNthUser( hostIdx );
        addMemberBody.role = 'fieldPlayers';
        res = await appAgent.doPostRequest( `/api/v1/events/${eventId}/members`, addMemberBody );
        expect( res.status ).to.equal( 400 );

        // Login as testMember and leave event to test further
        appAgent.loginAsNthUser( testMemberIdx );
        res = await appAgent.doDeleteRequest( `/api/v1/events/${eventId}/subscribers/leave` );
        expect( res.status ).to.equal( 204 );
      } );

      it( 'Should return 409 when user event count is exceeded', async () =>
      {
        let curEventId;
        subscriberRole.role = 'fieldPlayers';
        addMemberBody.role = 'fieldPlayers';
        const eventIds = [ ];
        const lastUserIdxBeforeTest = appAgent.getUserCnt() - 1;

        for ( let i = 0; i < config.event.MAX_EVENT_PER_USER - 1; i++ )
        {
          // Create user-host to create an event
          await appAgent.createUserAndLogin();
          eventIds.push( ( await appAgent.createEntityByApi( creationEventUrl, creationEventBody,
            'events', 'eventId' ) )
            [ 0 ]
            .body.eventId );
          curEventId = eventIds[ eventIds.length - 1 ];

          // Login as testMember and subscribe to nth event
          appAgent.loginAsNthUser( testMemberIdx );
          res = await appAgent.doPostRequest( `/api/v1/events/${curEventId}/subscribers`, subscriberRole );
          expect( res.status ).to.equal( 201 );

          // Login as nth user-host and add member to corresponding event
          appAgent.loginAsLastUser();
          res = await appAgent.doPostRequest( `/api/v1/events/${curEventId}/members`, addMemberBody );
          expect( res.status ).to.equal( 201 );
        }

        // Subscribe for 2 events and then adding to first
        // Should return 201
        // And adding to second - 409
        // It needs because subscribing to event with exceeded event count is not possible ( ! )
        const twoEvents = 2;
        for ( let i = 0; i < twoEvents; i++ )
        {
          // Create user-host to create an event
          await appAgent.createUserAndLogin();
          eventIds.push( ( await appAgent.createEntityByApi( creationEventUrl, creationEventBody,
            'events', 'eventId' ) )
            [ 0 ]
            .body.eventId );
          curEventId = eventIds[ eventIds.length - 1 ];

          // Login as testMember and subscribe to nth event
          appAgent.loginAsNthUser( testMemberIdx );
          res = await appAgent.doPostRequest( `/api/v1/events/${curEventId}/subscribers`, subscriberRole );
          expect( res.status ).to.equal( 201 );
        }

        // Login as nth user-host and add member to corresponding event
        appAgent.loginAsNthUser( appAgent.getUserCnt() - 1 - 1 );
        res = await appAgent.doPostRequest(
          `/api/v1/events/${eventIds[ eventIds.length - 1 - 1 ]}/members`, addMemberBody
        );
        expect( res.status ).to.equal( 201 );

        // Login as nth user-host and try to add member to corresponding event
        appAgent.loginAsLastUser();
        res = await appAgent.doPostRequest(
          `/api/v1/events/${eventIds[ eventIds.length - 1 ]}/members`, addMemberBody
        );
        expect( res.status ).to.equal( 409 );

        // Login as host and kick testMember from corresponding event to test further
        appAgent.loginAsNthUser( lastUserIdxBeforeTest );
        let kickMemberUrl;
        let kickMemberBody;
        for ( let i = 0; i < config.event.MAX_EVENT_PER_USER; i++ )
        {
          appAgent.loginAsNextUser();
          kickMemberUrl = `/api/v1/events/${eventIds[ i ]}/members/kick`;
          kickMemberBody = { uid: memberId, role: 'fieldPlayers' };
          res = await appAgent.doDeleteRequest( kickMemberUrl, kickMemberBody );
          expect( res.status ).to.equal( 204 );
        }

        // Login as test member and leave last event subscriptions to test further
        appAgent.loginAsNthUser( testMemberIdx );
        res = await appAgent.doDeleteRequest(
          `/api/v1/events/${eventIds[ eventIds.length - 1 ]}/subscribers/leave`
        );
        expect( res.status ).to.equal( 204 );
      } );

      it( 'After succeed member adding event.userSubscriptions does not contain user id ' +
        '( goalkeeper & fieldPlayer )', async () =>
      {
        // Login as testMember and subscribe to event as goalkeeper
        appAgent.loginAsNthUser( testMemberIdx );
        subscriberRole.role = 'goalkeepers';
        res = await appAgent.doPostRequest( `/api/v1/events/${eventId}/subscribers`, subscriberRole );
        expect( res.status ).to.equal( 201 );

        // Login as event host and add testMember to event as goalkeeper
        appAgent.loginAsNthUser( hostIdx );
        addMemberBody.role = 'goalkeepers';
        res = await appAgent.doPostRequest( `/api/v1/events/${eventId}/members`, addMemberBody );
        expect( res.status ).to.equal( 201 );

        // Check db to presence testMember id in event.userSubscriptions
        const eventGoalkeeper = await Event.findOne( { _id: eventId,
          'userSubscriptions.participant': memberId } );
        expect( eventGoalkeeper ).to.be.null;

        // Login as testMember and leave event to test further
        appAgent.loginAsNthUser( testMemberIdx );
        let leaveEventMembersBody = { role: 'goalkeepers' };
        res = await appAgent.doDeleteRequest( `/api/v1/events/${eventId}/members/leave`,
          leaveEventMembersBody );
        expect( res.status ).to.equal( 204 );

        // Subscribe to event as fieldPlayer
        subscriberRole.role = 'fieldPlayers';
        res = await appAgent.doPostRequest( `/api/v1/events/${eventId}/subscribers`, subscriberRole );
        expect( res.status ).to.equal( 201 );

        // Login as event host and add testMember to event as fieldPlayer
        appAgent.loginAsNthUser( hostIdx );
        addMemberBody.role = 'fieldPlayers';
        res = await appAgent.doPostRequest( `/api/v1/events/${eventId}/members`, addMemberBody );
        expect( res.status ).to.equal( 201 );

        // Check db to presence testMember id in event.userSubscriptions
        const eventFieldPlayers = await Event.findOne( { _id: eventId,
          'userSubscriptions.participant': memberId } );
        expect( eventFieldPlayers ).to.be.null;

        // Login as test member and leave event to test further
        appAgent.loginAsNthUser( testMemberIdx );
        leaveEventMembersBody = { role: 'fieldPlayers' };
        res = await appAgent.doDeleteRequest( `/api/v1/events/${eventId}/members/leave`,
          leaveEventMembersBody );
        expect( res.status ).to.equal( 204 );
      } );

      it( 'After succeed member adding user.eventSubscriptions does not contain event id',
        async () =>
        {
          // Login as testMember and subscribe to event as field player or goalkeeper
          appAgent.loginAsNthUser( testMemberIdx );
          subscriberRole.role = 'goalkeepers';
          res = await appAgent.doPostRequest( `/api/v1/events/${eventId}/subscribers`, subscriberRole );
          expect( res.status ).to.equal( 201 );

          // Login as event host and add to event testMember
          appAgent.loginAsNthUser( hostIdx );
          addMemberBody.role = 'goalkeepers';
          res = await appAgent.doPostRequest( `/api/v1/events/${eventId}/members`, addMemberBody );
          expect( res.status ).to.equal( 201 );

          // Check db to presence event id in user.eventSubscriptions
          const user = await Users.findOne( { _id: memberId, eventSubscriptions: eventId } );
          expect( user ).to.be.null;

          // Login as testMember and leave event to continue to test in further
          appAgent.loginAsNthUser( testMemberIdx );
          const leaveEventMembersBody = { role: 'goalkeepers' };
          res = await appAgent.doDeleteRequest( `/api/v1/events/${eventId}/members/leave`,
            leaveEventMembersBody );
          expect( res.status ).to.equal( 204 );
        } );

      it( 'After succeed member adding goalkeepers contain user id', async () =>
      {
        // Login as testMember and subscribe as goalkeeper
        appAgent.loginAsNthUser( testMemberIdx );
        subscriberRole.role = 'goalkeepers';
        res = await appAgent.doPostRequest( `/api/v1/events/${eventId}/subscribers`, subscriberRole );
        expect( res.status ).to.equal( 201 );

        // Login as event host and add testMember to event as goalkeeper
        appAgent.loginAsNthUser( hostIdx );
        addMemberBody.role = 'goalkeepers';
        res = await appAgent.doPostRequest( `/api/v1/events/${eventId}/members`, addMemberBody );
        expect( res.status ).to.equal( 201 );

        // Check db for presence event.goalkeepers testMember id
        const eventGoalkeeper = await Event.findOne( { _id: eventId, goalkeepers: memberId } );
        expect( eventGoalkeeper ).to.be.not.null;

        // Login as testMember and leave event to continue to test event in further
        appAgent.loginAsNthUser( testMemberIdx );
        const leaveEventMembersBody = { role: 'goalkeepers' };
        res = await appAgent.doDeleteRequest( `/api/v1/events/${eventId}/members/leave`,
          leaveEventMembersBody );
        expect( res.status ).to.equal( 204 );
      } );

      it( 'After succeed member adding curMemberCnt and goalkeepersCnt increased by 1', async () =>
      {
        // Save goalkeepersCnt before adding goalkeeper
        const goalkeepersCntBefore = ( await Event.findOne( { _id: eventId } ) )
          .goalkeepersCnt;
        expect( goalkeepersCntBefore ).to.be.a( 'number' );

        // Login as testMember and subscribe as goalkeeper
        appAgent.loginAsNthUser( testMemberIdx );
        subscriberRole.role = 'goalkeepers';
        res = await appAgent.doPostRequest( `/api/v1/events/${eventId}/subscribers`, subscriberRole );
        expect( res.status ).to.equal( 201 );

        // Login as event host and add testMember to event as goalkeeper
        appAgent.loginAsNthUser( hostIdx );
        addMemberBody.role = 'goalkeepers';
        res = await appAgent.doPostRequest( `/api/v1/events/${eventId}/members`, addMemberBody );
        expect( res.status ).to.equal( 201 );

        // Check db for event.curMemberCnt and event.goalkeepersCnt values
        const goalkeeperInc = 1;
        const goalkeepersCntAfter = ( await Event.findOne( { _id: eventId } ) )
          .goalkeepersCnt;
        expect( goalkeepersCntBefore + goalkeeperInc ).to.be.equal( goalkeepersCntAfter );

        // Login as testMember and leave event to continue to test event in further
        appAgent.loginAsNthUser( testMemberIdx );
        const leaveEventMembersBody = { role: 'goalkeepers' };
        res = await appAgent.doDeleteRequest( `/api/v1/events/${eventId}/members/leave`,
          leaveEventMembersBody );
        expect( res.status ).to.equal( 204 );
      } );

      it( 'After succeed member adding fieldPlayers contains user id', async () =>
      {
        // Save fieldPlayersCnt before adding field player
        const fieldPlayersCntBefore = ( await Event.findOne( { _id: eventId } ) )
          .fieldPlayersCnt;
        expect( fieldPlayersCntBefore ).to.be.a( 'number' );

        // Login as testMember and subscribe as fieldPlayer
        appAgent.loginAsNthUser( testMemberIdx );
        subscriberRole.role = 'fieldPlayers';
        res = await appAgent.doPostRequest( `/api/v1/events/${eventId}/subscribers`, subscriberRole );
        expect( res.status ).to.equal( 201 );

        // Login as event host and add testMember to event as fieldPlayer
        appAgent.loginAsNthUser( hostIdx );
        addMemberBody.role = 'fieldPlayers';
        res = await appAgent.doPostRequest( `/api/v1/events/${eventId}/members`, addMemberBody );
        expect( res.status ).to.equal( 201 );

        // Check db for presence event.fieldPlayers testMember id
        const fieldPlayersInc = 1;
        const fieldPlayersCntAfter = ( await Event.findOne( { _id: eventId } ) )
          .fieldPlayersCnt;
        expect( fieldPlayersCntBefore + fieldPlayersInc ).to.be.equal( fieldPlayersCntAfter );

        // Login as testMember and leave event to continue to test event in further
        appAgent.loginAsNthUser( testMemberIdx );
        const leaveEventMembersBody = { role: 'fieldPlayers' };
        res = await appAgent.doDeleteRequest( `/api/v1/events/${eventId}/members/leave`,
          leaveEventMembersBody );
        expect( res.status ).to.equal( 204 );
      } );

      it( 'After succeed member adding curMemberCnt and fieldPlayersCnt increased by 1', async () =>
      {
        // Save fieldPlayersCnt before adding field player
        const curMemberCntBefore = ( await Event.findOne( { _id: eventId } ) )
          .curMemberCnt;
        expect( curMemberCntBefore ).to.be.a( 'number' );

        // Login as testMember and subscribe as fieldPlayer or goalkeeper
        appAgent.loginAsNthUser( testMemberIdx );
        subscriberRole.role = 'fieldPlayers';
        res = await appAgent.doPostRequest( `/api/v1/events/${eventId}/subscribers`, subscriberRole );
        expect( res.status ).to.equal( 201 );

        // Login as event host and add testMember to event as fieldPlayer
        appAgent.loginAsNthUser( hostIdx );
        addMemberBody.role = 'fieldPlayers';
        res = await appAgent.doPostRequest( `/api/v1/events/${eventId}/members`, addMemberBody );
        expect( res.status ).to.equal( 201 );

        // Check db for event.curMemberCnt and event.fieldPlayersCnt values
        const curMembersInc = 1;
        const curMemberCntAfter = ( await Event.findOne( { _id: eventId } ) )
          .curMemberCnt;
        expect( curMemberCntBefore + curMembersInc ).to.be.equal( curMemberCntAfter );

        // Login as testMember and leave event to continue to test event in further
        appAgent.loginAsNthUser( testMemberIdx );
        const leaveEventMembersBody = { role: 'fieldPlayers' };
        res = await appAgent.doDeleteRequest( `/api/v1/events/${eventId}/members/leave`,
          leaveEventMembersBody );
        expect( res.status ).to.equal( 204 );
      } );

      it( 'After succeed member adding user.events contains event id', async () =>
      {
        // Login as testMember and subscribe to event
        appAgent.loginAsNthUser( testMemberIdx );
        subscriberRole.role = 'fieldPlayers';
        res = await appAgent.doPostRequest( `/api/v1/events/${eventId}/subscribers`, subscriberRole );
        expect( res.status ).to.equal( 201 );

        // Login as event host and add to event testMember
        appAgent.loginAsNthUser( hostIdx );
        addMemberBody.role = 'fieldPlayers';
        res = await appAgent.doPostRequest( `/api/v1/events/${eventId}/members`, addMemberBody );
        expect( res.status ).to.equal( 201 );

        // Check db to presence event id in user.events
        const user = await Users.findOne( { _id: memberId, events: eventId } );
        expect( user ).to.be.not.null;
      } );

      after( async () =>
      {
        await appAgent.removeAllEntitiesDirectly();
      } );
    } );

    describe( '/DELETE /leave', () =>
    {
      let appAgent;
      let eventId;
      const creationEventBody = {
        title: 'Test API',
        dateEventBegan: '2018-11-10T16:29:16.924Z',
        location: [
          -16.713907999999,
          -120.33600277777777777
        ],
        fieldPlayersCountMax: '8',
        minAge: '15',
        price: '500',
        role: 'fieldPlayers'
      };
      let memberId;
      const creationUserUrl = '/api/v1/auth/registration';
      const creationUserBody = { email: 'test_api@mail.com', password: 'test_test',
        firstName: 'test', secondName: 'test' };
      const creationEventUrl = '/api/v1/events';
      let res;
      const subscriberRole = { role: 'goalkeepers' };
      const testMemberIdx = 1;
      const hostIdx = 0;
      const addMemberBody = { };
      before( async () =>
      {
        appAgent =  new AppAgent( chai, app, creationUserUrl, creationUserBody, 'email' );

        // Create host
        await appAgent.createUserAndLogin();

        // Create event by host
        eventId = ( await appAgent.createEntityByApi( creationEventUrl, creationEventBody,
          'events', 'eventId' ) )
          [ 0 ]
          .body.eventId;

        // Create test subscriber
        await appAgent.createUserAndLogin();
        memberId = appAgent.getUserIdByIdx( testMemberIdx );
        addMemberBody.uid = memberId;
        addMemberBody.role = 'fieldPlayers';
      } );

      async function becomeMember ( role )
      {
        // Login as testMember and subscribe to event
        appAgent.loginAsNthUser( testMemberIdx );
        subscriberRole.role = role;
        res = await appAgent.doPostRequest( `/api/v1/events/${eventId}/subscribers`, subscriberRole );
        expect( res.status ).to.equal( 201 );

        // Login as event host and add to event testMember
        appAgent.loginAsNthUser( hostIdx );
        addMemberBody.role = role;
        res = await appAgent.doPostRequest( `/api/v1/events/${eventId}/members`, addMemberBody );
        expect( res.status ).to.equal( 201 );
      }

      async function leaveEvent ( role, returnCode )
      {
        appAgent.loginAsNthUser( testMemberIdx );
        const leaveEventMembersBody = { role };
        res = await appAgent.doDeleteRequest( `/api/v1/events/${eventId}/members/leave`,
          leaveEventMembersBody );
        expect( res.status ).to.equal( returnCode );
      }

      it( 'Should return 401 while leaving event without authorization', async () =>
      {
        await becomeMember( 'fieldPlayers' );

        appAgent.logout();
        const leaveEventMembersBody = { role: 'fieldPlayers' };
        res = await appAgent.doDeleteRequest( `/api/v1/events/${eventId}/members/leave`,
          leaveEventMembersBody );
        expect( res.status ).to.equal( 401 );

        await leaveEvent( 'fieldPlayers', 204 );
      } );

      it( 'Should return 204 when leave event with authorization', async () =>
      {
        await becomeMember( 'fieldPlayers' );

        await leaveEvent( 'fieldPlayers', 204 );
      } );

      it( 'Should return 400 when nonexistent event id is passed ( goalkeeper & fieldPlayer )',
        async () =>
        {
          await becomeMember( 'fieldPlayers' );

          const fakeEventId = '111111111111111111111111';
          appAgent.loginAsNthUser( testMemberIdx );
          const leaveEventMembersBody = { role: 'fieldPlayers' };
          res = await appAgent.doDeleteRequest( `/api/v1/events/${fakeEventId}/members/leave`,
            leaveEventMembersBody );
          expect( res.status ).to.equal( 400 );

          leaveEventMembersBody.role = 'goalkeepers';
          res = await appAgent.doDeleteRequest( `/api/v1/events/${fakeEventId}/members/leave`,
            leaveEventMembersBody );
          expect( res.status ).to.equal( 400 );

          await leaveEvent( 'fieldPlayers', 204 );
        } );

      it( 'Should return 400 when knocking user is not an event goalkeepers', async () =>
      {
        await becomeMember( 'fieldPlayers' );

        await leaveEvent( 'goalkeepers', 400 );

        await leaveEvent( 'fieldPlayers', 204 );
      } );

      it( 'Should return 400 when knocking user is not an event fieldPlayers', async () =>
      {
        await becomeMember( 'goalkeepers' );

        await leaveEvent( 'fieldPlayers', 400 );

        await leaveEvent( 'goalkeepers', 204 );
      } );

      it( 'Should return 400 when knocking user is an event host ( goalkeeper & fieldPlayer )',
        async () =>
        {
          // FieldPlayers
          appAgent.loginAsNthUser( hostIdx );
          const leaveEventMembersBody = { role: creationEventBody.role };
          res = await appAgent.doDeleteRequest( `/api/v1/events/${eventId}/members/leave`,
            leaveEventMembersBody );
          expect( res.status ).to.equal( 400 );

          // Goalkeepers
          creationEventBody.role = 'goalkeepers';
          const curEventId = ( await appAgent.createEntityByApi( creationEventUrl,
            creationEventBody, 'events', 'eventId' ) )
            [ 0 ]
            .body.eventId;
          leaveEventMembersBody.role = 'goalkeepers';
          res = await appAgent.doDeleteRequest( `/api/v1/events/${curEventId}/members/leave`,
            leaveEventMembersBody );
          expect( res.status ).to.equal( 400 );
        } );

      it( 'After succeed leave event as goalkeeper event.goalkeepers should not contain member id',
        async () =>
        {
          await becomeMember( 'goalkeepers' );

          const eventBefore = await Event.findOne( { _id: eventId, goalkeepers: memberId } );
          expect( eventBefore ).to.be.not.null;

          await leaveEvent( 'goalkeepers', 204 );

          const eventAfter = await Event.findOne( { _id: eventId, goalkeepers: memberId } );
          expect( eventAfter ).to.be.null;
        } );

      it( 'After succeed leave event as goalkeeper event.curMemberCnt should decrease by 1',
        async () =>
        {
          await becomeMember( 'goalkeepers' );

          const curMemberCntBefore = ( await Event.findOne( { _id: eventId } ) )
            .curMemberCnt;
          expect( curMemberCntBefore ).to.be.a( 'number' );

          await leaveEvent( 'goalkeepers', 204 );

          const memberCntDec = 1;
          const curMemberCntAfter = ( await Event.findOne( { _id: eventId } ) )
            .curMemberCnt;
          expect( curMemberCntBefore - memberCntDec ).to.be.equal( curMemberCntAfter );
        } );

      it( 'After succeed leave event as goalkeeper event.goalkeepersCnt should decrease by 1',
        async () =>
        {
          await becomeMember( 'goalkeepers' );

          const goalkeepersCntBefore = ( await Event.findOne( { _id: eventId } ) )
            .goalkeepersCnt;
          expect( goalkeepersCntBefore ).to.be.a( 'number' );

          await leaveEvent( 'goalkeepers', 204 );

          const goalkeepersCntDec = 1;
          const goalkeepersCntAfter = ( await Event.findOne( { _id: eventId } ) )
            .goalkeepersCnt;
          expect( goalkeepersCntBefore - goalkeepersCntDec ).to.be.equal( goalkeepersCntAfter );
        } );

      it( 'After succeed leave event as field player event.fieldPlayers ' +
        'should not contain member id', async () =>
      {
        await becomeMember( 'fieldPlayers' );

        const eventBefore = await Event.findOne( { _id: eventId, fieldPlayers: memberId } );
        expect( eventBefore ).to.be.not.null;

        await leaveEvent( 'fieldPlayers', 204 );

        const eventAfter = await Event.findOne( { _id: eventId, fieldPlayers: memberId } );
        expect( eventAfter ).to.be.null;
      } );

      it( 'After succeed leave event as field player event.curMemberCnt should decrease by 1',
        async () =>
        {
          await becomeMember( 'fieldPlayers' );

          const curMemberCntBefore = ( await Event.findOne( { _id: eventId } ) )
            .curMemberCnt;
          expect( curMemberCntBefore ).to.be.a( 'number' );

          await leaveEvent( 'fieldPlayers', 204 );

          const memberCntDec = 1;
          const curMemberCntAfter = ( await Event.findOne( { _id: eventId } ) )
            .curMemberCnt;
          expect( curMemberCntBefore - memberCntDec ).to.be.equal( curMemberCntAfter );
        } );

      it( 'After succeed leave event as field player event.fieldPlayersCnt should decrease by 1',
        async () =>
        {
          await becomeMember( 'fieldPlayers' );

          const fieldPlayersCntBefore = ( await Event.findOne( { _id: eventId } ) )
            .fieldPlayersCnt;
          expect( fieldPlayersCntBefore ).to.be.a( 'number' );

          await leaveEvent( 'fieldPlayers', 204 );

          const fieldPlayersCntDec = 1;
          const fieldPlayersCntAfter = ( await Event.findOne( { _id: eventId } ) )
            .fieldPlayersCnt;
          expect( fieldPlayersCntBefore - fieldPlayersCntDec ).to.be.equal( fieldPlayersCntAfter );
        } );

      it( 'After succeed leave event user.events should not contain event id', async () =>
      {
        await becomeMember( 'fieldPlayers' );

        const userBefore = await Users.findOne(  { _id: memberId, events: eventId } );
        expect( userBefore ).to.be.not.null;

        await leaveEvent( 'fieldPlayers', 204 );

        const userAfter = await Users.findOne(  { _id: memberId, events: eventId } );
        expect( userAfter ).to.be.null;
      } );

      after( async () =>
      {
        await appAgent.removeAllEntitiesDirectly();
      } );
    } );

    describe( '/DELETE /kick', () =>
    {
      let appAgent;
      let eventId;
      const creationEventBody = {
        title: 'Test API',
        dateEventBegan: '2018-11-10T16:29:16.924Z',
        location: [
          -16.713907999999,
          -120.33600277777777777
        ],
        fieldPlayersCountMax: '8',
        minAge: '15',
        price: '500',
        role: 'fieldPlayers'
      };
      let memberId;
      const creationUserUrl = '/api/v1/auth/registration';
      const creationUserBody = { email: 'test_api@mail.com', password: 'test_test',
        firstName: 'test', secondName: 'test' };
      const creationEventUrl = '/api/v1/events';
      let res;
      const subscriberRole = { role: 'goalkeepers' };
      const testMemberIdx = 1;
      const hostIdx = 0;
      const addMemberBody = { };
      let hostId;
      before( async () =>
      {
        appAgent =  new AppAgent( chai, app, creationUserUrl, creationUserBody, 'email' );

        // Create host
        await appAgent.createUserAndLogin();
        hostId = appAgent.getCurUserId();

        // Create event by host
        eventId = ( await appAgent.createEntityByApi( creationEventUrl, creationEventBody,
          'events', 'eventId' ) )
          [ 0 ]
          .body.eventId;

        // Create test subscriber
        await appAgent.createUserAndLogin();
        memberId = appAgent.getUserIdByIdx( testMemberIdx );
        addMemberBody.uid = memberId;
        addMemberBody.role = 'fieldPlayers';
      } );

      async function becomeMember ( role )
      {
        // Login as testMember and subscribe to event
        appAgent.loginAsNthUser( testMemberIdx );
        subscriberRole.role = role;
        res = await appAgent.doPostRequest( `/api/v1/events/${eventId}/subscribers`, subscriberRole );
        expect( res.status ).to.equal( 201 );

        // Login as event host and add to event testMember
        appAgent.loginAsNthUser( hostIdx );
        addMemberBody.role = role;
        res = await appAgent.doPostRequest( `/api/v1/events/${eventId}/members`, addMemberBody );
        expect( res.status ).to.equal( 201 );
      }

      async function kickUser ( role, uid, returnCode )
      {
        appAgent.loginAsNthUser( hostIdx );
        const kickEventMembersBody = { role, uid };
        res = await appAgent.doDeleteRequest( `/api/v1/events/${eventId}/members/kick`,
          kickEventMembersBody );
        expect( res.status ).to.equal( returnCode );
      }

      it( 'Should return 401 when kick member without authorization', async () =>
      {
        await becomeMember( 'goalkeepers' );

        appAgent.logout();
        const leaveEventMembersBody = { role: 'goalkeeper', uid: memberId };
        res = await appAgent.doDeleteRequest( `/api/v1/events/${eventId}/members/kick`,
          leaveEventMembersBody );
        expect( res.status ).to.equal( 401 );

        await kickUser( 'goalkeepers', memberId, 204 );
      } );

      it( 'Should return 204 when kick member with authorization', async () =>
      {
        await becomeMember( 'goalkeepers' );

        await kickUser( 'goalkeepers', memberId, 204 );
      } );

      it( 'Should return 400 when host try to kick himself', async () =>
      {
        await kickUser( 'goalkeepers', hostId, 400 );
      } );

      it( 'Should return 400 when nonexistent event id is passed ( goalkeeper & fieldPlayer )',
        async () =>
        {
          // Goalkeeper
          await becomeMember( 'goalkeepers' );
          const fakeEventId = '111111111111111111111111';
          appAgent.loginAsNthUser( hostIdx );
          let kickEventMembersBody = { role: 'goalkeepers', uid: memberId };
          res = await appAgent.doDeleteRequest( `/api/v1/events/${fakeEventId}/members/kick`,
            kickEventMembersBody );
          expect( res.status ).to.equal( 400 );

          await kickUser( 'goalkeepers', memberId, 204 );

          // FieldPlayer
          await becomeMember( 'fieldPlayers' );
          appAgent.loginAsNthUser( hostIdx );
          kickEventMembersBody = { role: 'fieldPlayers', uid: memberId };
          res = await appAgent.doDeleteRequest( `/api/v1/events/${fakeEventId}/members/kick`,
            kickEventMembersBody );
          expect( res.status ).to.equal( 400 );

          await kickUser( 'fieldPlayers', memberId, 204 );
        } );

      it( 'Should return 400 when target user is not an event goalkeepers', async () =>
      {
        await becomeMember( 'fieldPlayers' );

        await kickUser( 'goalkeepers', memberId, 400 );

        await kickUser( 'fieldPlayers', memberId, 204 );
      } );

      it( 'Should return 400 when target user is not an event fieldPlayers', async () =>
      {
        await becomeMember( 'goalkeepers' );

        await kickUser( 'fieldPlayers', memberId, 400 );

        await kickUser( 'goalkeepers', memberId, 204 );
      } );

      it( 'Should return 400 when knocking user is not event host ( goalkeeper & fieldPlayer )',
        async () =>
        {
          // Create malicious user ( now last created user is malicious user )
          await appAgent.createUserAndLogin();

          // Goalkeeper
          await becomeMember( 'goalkeepers' );

          // Login as malicious user
          appAgent.loginAsLastUser();
          let kickEventMembersBody = { role: 'goalkeepers', uid: memberId };
          res = await appAgent.doDeleteRequest( `/api/v1/events/${eventId}/members/kick`,
            kickEventMembersBody );
          expect( res.status ).to.equal( 400 );

          await kickUser( 'goalkeepers', memberId, 204 );

          // FieldPlayer
          await becomeMember( 'fieldPlayers' );

          // Login as malicious user
          appAgent.loginAsLastUser();
          kickEventMembersBody = { role: 'fieldPlayers', uid: memberId };
          res = await appAgent.doDeleteRequest( `/api/v1/events/${eventId}/members/kick`,
            kickEventMembersBody );
          expect( res.status ).to.equal( 400 );

          await kickUser( 'fieldPlayers', memberId, 204 );
        } );

      it( 'After succeed kick goalkeeper event.goalkeepers should not contain target id',
        async () =>
        {
          await becomeMember( 'goalkeepers' );

          const eventBefore = await Event.findOne( { _id: eventId, goalkeepers: memberId } );
          expect( eventBefore ).to.be.not.null;

          await kickUser( 'goalkeepers', memberId, 204 );

          const eventAfter = await Event.findOne( { _id: eventId, goalkeepers: memberId } );
          expect( eventAfter ).to.be.null;
        } );

      it( 'After succeed kick goalkeeper event.curMemberCnt should decrease by 1', async () =>
      {
        await becomeMember( 'goalkeepers' );

        const curMemberCntBefore = ( await Event.findOne( { _id: eventId } ) )
          .curMemberCnt;
        expect( curMemberCntBefore ).to.be.a( 'number' );

        await kickUser( 'goalkeepers', memberId, 204 );

        const memberCntDec = 1;
        const curMemberCntAfter = ( await Event.findOne( { _id: eventId } ) )
          .curMemberCnt;
        expect( curMemberCntBefore - memberCntDec ).to.be.equal( curMemberCntAfter );
      } );

      it( 'After succeed kick goalkeeper event.goalkeepersCnt should decrease by 1', async () =>
      {
        await becomeMember( 'goalkeepers' );

        const goalkeepersCntBefore = ( await Event.findOne( { _id: eventId } ) )
          .goalkeepersCnt;
        expect( goalkeepersCntBefore ).to.be.a( 'number' );

        await kickUser( 'goalkeepers', memberId, 204 );

        const goalkeepersCntDec = 1;
        const goalkeepersCntAfter = ( await Event.findOne( { _id: eventId } ) )
          .goalkeepersCnt;
        expect( goalkeepersCntBefore - goalkeepersCntDec ).to.be.equal( goalkeepersCntAfter );
      } );

      it( 'After succeed kick field player event.fieldPlayers should not contain target id',
        async () =>
        {
          await becomeMember( 'fieldPlayers' );

          const eventBefore = await Event.findOne( { _id: eventId, fieldPlayers: memberId } );
          expect( eventBefore ).to.be.not.null;

          await kickUser( 'fieldPlayers', memberId, 204 );

          const eventAfter = await Event.findOne( { _id: eventId, fieldPlayers: memberId } );
          expect( eventAfter ).to.be.null;
        } );

      it( 'After succeed kick field player event.curMemberCnt should decrease by 1', async () =>
      {
        await becomeMember( 'fieldPlayers' );

        const curMemberCntBefore = ( await Event.findOne( { _id: eventId } ) )
          .curMemberCnt;
        expect( curMemberCntBefore ).to.be.a( 'number' );

        await kickUser( 'fieldPlayers', memberId, 204 );

        const memberCntDec = 1;
        const curMemberCntAfter = ( await Event.findOne( { _id: eventId } ) )
          .curMemberCnt;
        expect( curMemberCntBefore - memberCntDec ).to.be.equal( curMemberCntAfter );
      } );

      it( 'After succeed kick field player event.fieldPlayersCnt should decrease by 1', async () =>
      {
        await becomeMember( 'fieldPlayers' );

        const fieldPlayersCntBefore = ( await Event.findOne( { _id: eventId } ) )
          .fieldPlayersCnt;
        expect( fieldPlayersCntBefore ).to.be.a( 'number' );

        await kickUser( 'fieldPlayers', memberId, 204 );

        const fieldPlayersCntDec = 1;
        const fieldPlayersCntAfter = ( await Event.findOne( { _id: eventId } ) )
          .fieldPlayersCnt;
        expect( fieldPlayersCntBefore - fieldPlayersCntDec ).to.be.equal( fieldPlayersCntAfter );
      } );

      it( 'After succeed kick user user.events should not contain event id', async () =>
      {
        await becomeMember( 'fieldPlayers' );

        const userBefore = await Users.findOne(  { _id: memberId, events: eventId } );
        expect( userBefore ).to.be.not.null;

        await kickUser( 'fieldPlayers', memberId, 204 );

        const userAfter = await Users.findOne(  { _id: memberId, events: eventId } );
        expect( userAfter ).to.be.null;
      } );

      after( async () =>
      {
        await appAgent.removeAllEntitiesDirectly();
      } );
    } );
  } );
} );
