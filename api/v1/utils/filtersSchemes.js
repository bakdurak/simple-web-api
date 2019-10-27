const compareOperType = {
  $eq: 'string',
  $gt: 'string',
  $gte: 'string',
  $lt: 'string',
  $lte: 'string'
};

module.exports =
  {
    event: {
      filters: {
        curMemberCnt: compareOperType,
        minAge: compareOperType,
        dateEventBegan: compareOperType,
        price: compareOperType,
        _id: compareOperType,
        longitude: 'string',
        latitude: 'string',
        rad: 'string'
      },
      order: {
        curMemberCnt: 'string',
        minAge: 'string',
        dateEventBegan: 'string',
        price: 'string'
      },
      offset: 'string',
      feed: 'string'
    }
  };
