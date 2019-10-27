// Trick to fail test
// If the right chai tool for the test is missing or ugly
function chaiFailTest ( expect )
{
  return ( expect( 1 ).to.equal( 0 ) );
}

module.exports = chaiFailTest;
