const config = require( '../../../config' );
const BusinessRuleException = require( '../../versionIndependentUtils/BusinessRuleException' );
const mongoose = require( 'mongoose' );
const logger = require( '../../../logger' );
require( 'dotenv' ).config();

const txnCommitCntExceeded = 'Transaction commit retry is exceeded';
const sessionWithRetry =
  {
    async commitWithRetry ( session )
    {
      let tryCnt = 0;
      while ( tryCnt < config.transaction.TRANSACTION_COMMIT_RETRY_CNT )
      {
        try
        {
          await session.commitTransaction();

          if ( process.env.NODE_ENV === 'dev' )
          {
            console.log( 'Transaction committed.' );
          }

          break;
        }
        catch ( error )
        {
          if ( error.errorLabels
            && error.errorLabels.indexOf( 'UnknownTransactionCommitResult' ) >= 0 )
          {
            if ( process.env.NODE_ENV === 'dev' )
            {
              console.log( 'UnknownTransactionCommitResult, retrying commit operation ...' );
            }

            tryCnt += 1;
          }
          else
          {
            throw error;
          }
        }
      }

      if ( tryCnt === config.transaction.TRANSACTION_COMMIT_RETRY_CNT )
      {
        throw new BusinessRuleException( 408, txnCommitCntExceeded );
      }
      else
      {
        logger.info( 'Transaction commit retry cnt', { cnt: tryCnt } );
      }
    },

    async runWholeTransactionWithRetry ( txnFunc )
    {
      let tryCnt = 0;
      const session = await mongoose.startSession();
      session.startTransaction();
      while ( tryCnt < config.transaction.WHOLE_TRANSACTION_RETRY_CNT )
      {
        try
        {
          await txnFunc( session );

          await sessionWithRetry.commitWithRetry( session );

          break;
        }
        catch ( error )
        {
          if ( error.errorLabels && error.errorLabels.indexOf( 'TransientTransactionError' ) >= 0 )
          {
            if ( process.env.NODE_ENV === 'dev' )
            {
              console.log( 'TransientTransactionError, retrying transaction ...' );
            }
            tryCnt += 1;
          }
          else
          {
            await session.abortTransaction();
            session.endSession();

            if ( ! ( error instanceof BusinessRuleException ) )
            {
              logger.warn( 'Whole transaction, unrecognized error', error );
            }
            else if ( error.message === txnCommitCntExceeded )
            {
              logger.warn( 'Transaction commit retry is exceeded', { wholeTxnCnt: tryCnt } );
            }

            throw error;
          }
        }
      }

      if ( tryCnt === config.transaction.WHOLE_TRANSACTION_RETRY_CNT )
      {
        await session.abortTransaction();
        session.endSession();

        logger.warn( 'Whole transaction retry cnt is exceeded' );

        throw new BusinessRuleException( 500, 'Transaction write conflict retry is exceeded' );
      }
      else
      {
        session.endSession();

        logger.info( 'Whole transaction retry cnt', { cnt: tryCnt } );
      }
    }
  };

module.exports = sessionWithRetry;
