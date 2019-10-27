const Url =
  {
    getRawQueryString ( url )
    {
      const queryIndex = url.indexOf( '?' );
      return ( queryIndex >= 0 ) ? url.slice( queryIndex + 1 ) : '';
    }
  };

module.exports = Url;
