# Overview
> Example Node application using Express and Mongoose.
## Getting started
* ``` npm run dev ```
## Code overview
## Dependencies
* [express](https://github.com/expressjs/express) - Handling and serving http requests
* [mongoose](https://github.com/Automattic/mongoose) - MongoDB ODM
* [passport](https://github.com/jaredhanson/passport) - User authentication
* [express-session](https://github.com/expressjs/session) - Session middleware
* [connect-mongo](https://github.com/jdesboeufs/connect-mongo) - Persistence session storage
* [express-async-handler](https://github.com/Abazhenov/express-async-handler) - Middleware for handling exceptions inside of async express routes
* [helmet](https://github.com/helmetjs/helmet) - Protects app by setting / disabling some HTTP headers
* [multer](https://github.com/expressjs/multer) - Middleware for handling multipart/form-data
* [sharp](https://github.com/lovell/sharp) - Asynchronous image processing 
* [winston](https://github.com/winstonjs/winston) - Logger
## DevDependencies
* [eslint](https://github.com/eslint/eslint) - Code style rules
* [mocha](https://github.com/mochajs/mocha) - Framework for testing
* [chai](https://github.com/chaijs/chai) - Assertion library
* [mongodb](https://github.com/mongodb/node-mongodb-native) - Native MongoDB driver
## Application Structure
* ``` ./ ```
    * ``` index.js ``` - Application entry point
    * ``` database.js ``` - Connecting to database
    * ``` app.js ``` - Express application customization ( adding general middleware, etc )
    * ``` config.js ``` - Contains application public settings
    * ``` other ``` - Scripts indirectly related to application such as benchmarks for database indexes
    
* ``` ./test ```
    * ``` /api ``` - Endpoints tests
    * ``` /unit ``` - Utils tests
    * ``` /utils ``` - Utils for tests
    * ``` /images ``` - Images intended only for uploading tests

* ``` ./api ```
    * ``` /tasks ``` - Accessory applications
    * ``` /versionIndependentUtils ``` - Utils that does not depend on api version
    * ``` /v(x) ``` - Middleware, routes, utils, that relate to the (x) api version 
    * ``` /ReadBeforeMakingChanges.txt ``` - Instructions to api versioning
    ( Versioning performed hastily so there is no any framework for that )
