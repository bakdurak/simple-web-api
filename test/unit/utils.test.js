const expect = require( 'chai' ).expect;
const config = require( '../../config' );

const fromNumToGeoPoint = require( '../../api/v1/utils/fromNumToGeoPoint' );
const buildImgPath = require( '../../api/v1/utils/buildImgPath' );

describe( 'Utils',  () =>
{
  describe( 'FromNumToGeoPoint', () =>
  {
    const geoPointCoords = [ 124.622, 88.999666111 ];
    const processedPoint = fromNumToGeoPoint( geoPointCoords );

    it( 'Longitude & latitude have no more than 6 digits after comma', () =>
    {
      for ( let i = 0; i < 2; i++ )
      {
        const digitsAfterComma = processedPoint.coordinates[ i ]
          .toString()
          .split( '.' )
          [ 1 ]
          .length;
        expect( digitsAfterComma ).to.be.at.most( config.common.GEO_POINT_PRECISION );
      }
    } );

    it( 'Point must contain only type and coordinated properties', () =>
    {
      expect( processedPoint ).to.be.an( 'object' ).that.has
        .all.keys( 'type', 'coordinates' );
    } );

    it( 'Coordinates are an array of 2 and only 2 elements', () =>
    {
      expect( processedPoint.coordinates ).to.be.an( 'array' ).that.have.lengthOf( 2 );
    } );

    it( 'All coordinates are numbers', () =>
    {
      for ( let i = 0; i < 2; i++ )
      {
        expect( processedPoint.coordinates[ i ] ).is.a( 'number' );
      }
    } );
  } );

  describe( 'BuildImgSubDirPath', () =>
  {
    const id = '123456';
    const dirDepth = 2;
    const symbolsPerSubDir = 3;

    const path = buildImgPath( id, dirDepth, symbolsPerSubDir );
    const directories = path.split( '/' );

    it( 'Should have sub directory name length equal to symbolsPerSubDir', () =>
    {
      for ( let i = 0; i < dirDepth; i++ )
      {
        expect( directories[ i ] ).to.have.lengthOf( symbolsPerSubDir );
      }
    } );

    it( 'Should have exactly dirDepth sub directories', () =>
    {
      expect( directories ).to.have.lengthOf( dirDepth  );
    } );
  } );
} );
