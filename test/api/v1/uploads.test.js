require( 'dotenv' ).config();
const app = require( '../../../index' );
const expect = require( 'chai' ).expect;
const chaiHttp = require( 'chai-http' );
const chai = require( 'chai' );
const config = require( '../../../config' );
const Upload = require( '../../../api/models/uploads' );
const User = require( '../../../api/models/users' );
const pify = require( 'pify' );
let fs = require( 'fs' );
fs = pify( fs );
let rimraf = require( 'rimraf' );
rimraf = pify( rimraf );
const AppAgent = require( '../../utils/AppAgent' );
const path = require( 'path' );

chai.use( chaiHttp );

describe( 'Uploads', () =>
{
  describe( '/POST uploads/avatar', () =>
  {
    const imgPath = path.join( './test', 'images', path.sep );
    let appAgent;
    let authCookie;
    let userId;
    const creationUserUrl = '/api/v1/auth/registration';
    const creationUserBody = { email: 'test_api@mail.com', password: 'test_test',
      firstName: 'test', secondName: 'test' };

    before( async () =>
    {
      appAgent =  new AppAgent( chai, app, creationUserUrl, creationUserBody, 'email' );

      // Create host
      await appAgent.createUserAndLogin();

      userId = appAgent.getCurUserId();
      authCookie = appAgent.getCurAuthKey();
    } );

    async function loadImg ( imgName )
    {
      const res = await chai.request( app )
        .post( '/api/v1/uploads/avatar' )
        .attach( 'avatar', imgPath + imgName, imgName )
        .set( 'Cookie', authCookie );

      return res;
    }

    const root = process.env.UPLOADS_DIR;
    const imgSizes = config.uploads.UPLOAD_PX_SIZES;

    it( 'Should return 401 while posting event without authorization', async () =>
    {
      const res = await chai.request( app )
        .post( '/api/v1/uploads/avatar' );

      expect( res.status ).to.equal( 401 );
    } );

    // Then correct 500 to 400
    // By transforming errors from various modules to own BusinessRuleException
    it( 'Should return 500 when passing image, size in bytes of which over ' +
      'than config max image size', async () =>
    {
      const imgOver9mb = 'img_over_9mb.jpg';
      const res = await loadImg( imgOver9mb );

      expect( res.status ).to.equal( 500 );
    } );

    // Same as above
    it( 'Should return 500 when passed file is not image', async () =>
    {
      const isNotImg = 'isNotImg.jpg';
      const res = await loadImg( isNotImg );

      expect( res.status ).to.equal( 500 );
    } );

    let pathToCurImg = '';
    it( 'Should return 201 when passed correct image', async () =>
    {
      const correctImage = 'correct_avatar.jpg';
      const res = await loadImg( correctImage );

      // Save path to new image
      pathToCurImg = res.body.avatarUrl;

      expect( res.status ).to.equal( 201 );
    } );

    it( 'Db should have an image id in corresponding collection', async () =>
    {
      const imgId = pathToCurImg.match( /(\w*).jpg$/ )
        [ 1 ];

      const imgDb = await Upload.findOne( { _id: imgId } );

      expect( imgDb ).to.not.be.null;
    } );

    it( 'The user loaded an avatar should have new image id as a value avatar field', async () =>
    {
      const imgId = pathToCurImg.match( /(\w*).jpg$/ )
        [ 1 ];

      const user = await User.findOne( { _id: userId, avatar: imgId } );

      expect( user ).to.not.be.null;
    } );

    let pathToNewImg;
    let pathToOldImg;
    it( 'After that new avatar is uploaded the old must be removed from uploads collection',
      async () =>
      {
        const correctImage = 'correct_avatar.jpg';
        const res = await loadImg( correctImage );

        const oldImgId = pathToCurImg.match( /(\w*).jpg$/ )
          [ 1 ];
        const oldImg = await Upload.findOne( { _id: oldImgId } );

        // After all checks save path to new and old image
        pathToOldImg = pathToCurImg;
        pathToNewImg = res.body.avatarUrl;

        expect( oldImg ).to.be.null;
      } );

    const nginxUrl = process.env.NGINX_URL;
    it( 'Should return images for all predefined sizes and original image', async () =>
    {
      const subDirs = pathToNewImg.split( path.sep );
      let subPath = '';
      for ( let i = 4; i < subDirs.length ; i++ )
      {
        subPath += `${subDirs[ i ]}/`;
      }
      subPath = subPath.substr( 0, subPath.length - 1 );

      // Thumbnails check
      let fullImgPath;
      for ( const size in imgSizes )
      {
        fullImgPath = `/static/upload/${imgSizes[ size ]}/${subPath}`;
        const imgBufLen = ( await chai.request( nginxUrl )
          .get( fullImgPath ) )
          .body.length;

        expect( imgBufLen ).to.not.be.undefined;
      }

      // Original check
      fullImgPath = `/static/upload/${config.uploads.DIR_FOR_STORE_ORIGINAL_IMGS}/${subPath}`;
      const imgBufLen = ( await chai.request( nginxUrl )
        .get( fullImgPath ) )
        .body.length;

      expect( imgBufLen ).to.not.be.undefined;
    } );

    it( 'Should remove old avatar thumbnails', async () =>
    {
      const subDirs = pathToOldImg.split( '/' );
      let subPath = '';
      for ( let i = 4; i < subDirs.length ; i++ )
      {
        subPath += `${subDirs[ i ]}/`;
      }
      subPath = subPath.substr( 0, subPath.length - 1 );

      // Thumbnails check
      let fullImgPath;
      for ( const size in imgSizes )
      {
        fullImgPath = `/static/upload/${imgSizes[ size ]}/${subPath}`;
        const imgBufLen = ( await chai.request( nginxUrl )
          .get( fullImgPath ) )
          .body.length;

        expect( imgBufLen ).to.be.undefined;
      }
    } );

    it( 'Should remove original image', async () =>
    {
      const subDirs = pathToOldImg.split( '/' );
      let subPath = '';
      for ( let i = 4; i < subDirs.length ; i++ )
      {
        subPath += `${subDirs[ i ]}/`;
      }
      subPath = subPath.substr( 0, subPath.length - 1 );

      const fullOrigImgPath = `${root}/${config.uploads.DIR_FOR_STORE_ORIGINAL_IMGS}/${subPath}`;
      let imgBuff;
      try
      {
        imgBuff = await fs.readFile( fullOrigImgPath );
      }
      catch ( error )
      {
        console.log( error );
      }

      expect( imgBuff ).to.be.undefined;
    } );

    // Remove all created sub directories and images also clear db
    after( async () =>
    {
      // Remove old images
      const firstSubDirOld = pathToOldImg.split( '/' )
        [ 4 ];
      let removeOldImgPath;
      for ( const size in imgSizes )
      {
        removeOldImgPath = `${root}/${imgSizes[ size ]}/${firstSubDirOld}`;
        await rimraf( removeOldImgPath );
      }

      // Remove new images
      const firstSubDirNew = pathToNewImg.split( '/' )
        [ 4 ];
      let removeNewImgPath;
      for ( const size in imgSizes )
      {
        removeNewImgPath = `${root}/${imgSizes[ size ]}/${firstSubDirNew}`;
        await rimraf( removeNewImgPath );
      }

      // Remove originals
      let origRemovePath = `${root}/${config.uploads.DIR_FOR_STORE_ORIGINAL_IMGS}/${firstSubDirOld}`;
      await rimraf( origRemovePath );
      origRemovePath = `${root}/${config.uploads.DIR_FOR_STORE_ORIGINAL_IMGS}/${firstSubDirNew}`;
      await rimraf( origRemovePath );

      // Clear db
      const imgId = pathToNewImg.match( /(\w*).jpg$/ )
        [ 1 ];
      await Upload.deleteOne( { _id: imgId } );
      await User.updateOne( { _id: userId }, { $set: { avatar: null } } );

      await appAgent.removeAllEntitiesDirectly();
    } );
  } );
} );
