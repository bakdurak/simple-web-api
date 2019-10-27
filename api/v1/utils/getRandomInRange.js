function getRandomInRange ( from, to, fixed )
{
  // .toFixed() returns string, so ' * 1' is a trick to convert to number
  return ( ( Math.random() * ( to - from ) ) + from ).toFixed( fixed ) * 1;
}

module.exports = getRandomInRange;
