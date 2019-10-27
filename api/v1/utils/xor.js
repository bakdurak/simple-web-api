function xor ( arg1, arg2 )
{
  return ( ( arg1 && ! arg2 ) || ( ! arg1 && arg2 ) );
}

module.exports = xor;
