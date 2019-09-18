import AWS from 'aws-sdk';
import Debug from 'debug';
import * as os from 'os';
import { DynamoDBLock, DynamoDBLockManager } from '.';

const awsRegion = 'us-east-1';
const awsProfileName = 'crisis-mgt-noamp-dev';
const myLockTableName = `Lock-${awsProfileName}`;
const myLockKey = 'test';

AWS.config.credentials = new AWS.SharedIniFileCredentials({ profile: awsProfileName });
AWS.config.update({ credentials: AWS.config.credentials, region: awsRegion });

const dbDocClient = new AWS.DynamoDB.DocumentClient();

const dbLockMgr = new DynamoDBLockManager(dbDocClient, myLockTableName, os.hostname(), os.userInfo().username);

function handleReturnedLock(aLock: DynamoDBLock | null) {
  try {
    const dbg = Debug('handleReturnedLock');
    if (aLock) {
      if (aLock.createdByUUID === dbLockMgr.myLockUUID) {
        dbg('This is my lock, so set a timer to release it in 45 secs to act like we are doing some work.');
        setTimeout(() => {
          dbLockMgr
            .releaseMyLock(myLockKey)
            .catch(err => {
              throw new Error(`Failed to release lock: ${err}`);
            })
            .then(data => {
              dbg('Released lock: %O', data);
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
    dbLockMgr
      .setLock(myLockKey)
      .catch(err => {
        throw new Error(`Failed to set lock: ${err}`);
      })
      .then(data => {
        dbg('Set lock: %O', data);
        handleReturnedLock(data);
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
