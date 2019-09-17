import AWS from 'aws-sdk';
import Debug from 'debug';
import { DynamoDBLock, DynamoDBLockManager } from '.';

const awsRegion = 'us-east-1';
const awsProfileName = 'crisis-mgt-noamp-dev';
const myLockTableName = `Lock-${awsProfileName}`;
const myLockKey = 'test';

AWS.config.credentials = new AWS.SharedIniFileCredentials({ profile: awsProfileName });
AWS.config.update({ credentials: AWS.config.credentials, region: awsRegion });

const dbDocClient = new AWS.DynamoDB.DocumentClient();

const dbLockMgr = new DynamoDBLockManager(dbDocClient, myLockTableName);

function handleReturnedLock(aLock: DynamoDBLock | null) {
  try {
    const dbg = Debug('handleReturnedLock');
    if (aLock) {
      if (aLock.createdByUUID === dbLockMgr.myLockUUID) {
        dbg(
          'This is my lock, so set a timer to release this lock in 45 seconds to act like we are doing some work for a while.',
        );
        setTimeout(() => {
          dbLockMgr.releaseMyLock(myLockKey, (err, data) => {
            if (err) {
              throw new Error(`Failed to release lock: ${err}`);
            } else {
              dbg('Released lock: %O', data);
            }
          });
        }, 30 * 1000);
      } else {
        dbg('This is not my lock, therefore this lock is blocking me. Come back after it has expired and try again.');
        setTimeout(() => {
          tryToSetLock();
        }, aLock.lockExpireSecs);
      }
    }
  } catch (err) {
    throw new Error(`Failed during handleReturnedLock: ${err}`);
  }
}

function tryToSetLock() {
  try {
    const dbg = Debug('handleReturnedLock');
    dbLockMgr.setLock(myLockKey, (err: any, aLock: DynamoDBLock | null) => {
      if (err) {
        dbg('Failed to set lock: %O', err);
      } else {
        dbg('Set lock: %O', aLock);
        handleReturnedLock(aLock);
      }
    });
  } catch (err) {
    throw new Error(`Failed during tryToSetLock: ${err}`);
  }
}

function sample() {
  try {
    const dbg = Debug('sample');
    tryToSetLock();
  } catch (err) {
    throw new Error(`Failed during test: ${err}`);
  }
}

sample();
