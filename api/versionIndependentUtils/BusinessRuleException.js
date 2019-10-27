const config = require( '../../config' );

/**
 * Marker exception class mainly intended for distinguish inner business rule exceptions
 * and third-party module exceptions
 **/
class BusinessRuleException
{
  constructor ( status, message, level = config.errorLevels.silly, rest = { } )
  {
    this.status = status || 400;
    this.message = message || 'It seems we have something wrong';
    this.level = level;
    this.rest = rest;
  }
}

module.exports = BusinessRuleException;
