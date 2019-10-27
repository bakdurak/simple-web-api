module.exports =
  {
    auth: {
      HASH_ROUNDS: 10,
      TOUCH_AFTER: 60 * 60 * 24 * 13, // TTL + 1 DAY - never
      SESSION_TTL: 60 * 60 * 24 * 12,
      SID_EXPIRES: 1000 * 60 * 60 * 24 * 3,
      SESSION_NAME: 'sid',
      CSRF_COOKIE_NAME: 'csrf-token',
      CSRF_HEADER_NAME: 'x-csrf-token',
      CSRF_TOKEN_LENGTH: 24
    },

    uploads: {
      UPLOADS_DIR: 'upload',
      UPLOAD_PX_SIZES: {
        small: 200,
        medium: 400,
        large: 800,
        extralarge: 1200
      },
      ORIGINAL_IMG_SIZE: 1200,
      JPEG_QUALITY: 80,
      DIR_FOR_STORE_ORIGINAL_IMGS: 'original',
      MAX_IMG_SIZE_BYTES: 5 * 1024 * 1024
    },

    user: {
      AVAILABLE_FIELDS_TO_UPDATE_USER: [ 'secondName', 'firstName' ]
    },

    event: {
      MAX_USER_PER_EVENT_SUBSCRIPTIONS_CNT: 15,
      MAX_EVENT_PER_USER_SUBSCRIPTIONS_CNT: 5,
      MAX_EVENT_PER_USER: 10,
      MAX_CREATED_EVENTS_PER_USER: 17,
      EVENT_PER_PAGE: 10,
      EVENTS_MAX_OFFSET: 10000
    },

    transaction: {
      TRANSACTION_COMMIT_RETRY_CNT: 10,
      WHOLE_TRANSACTION_RETRY_CNT: 10
    },

    common: {
      GEO_POINT_PRECISION: 6,
      MAX_QS_PARAM_CNT: 100
    },

    errorLevels: {
      error: 0,
      warn: 1,
      info: 2,
      silly: 5
    }
  };
