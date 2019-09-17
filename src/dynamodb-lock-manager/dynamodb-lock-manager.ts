import { DynamoDBLock } from './dynamodb-lock';

import Debug from 'debug';
const debug = Debug('dynamodb-lock');

import { DynamoDB } from 'aws-sdk';
import uuidv1 from 'uuid/v1';

export class DynamoDBLockManager {
  public myLockUUID: string = '';
  public lockSecsToLive = 10; // a lock is only held for N seconds
  public lockRefreshSecs = this.lockSecsToLive / 2; // we will attempt to extend each active lock at the mid-life of the lock

  // deleteMyLockDelaySecs: delay for N seconds before actually purging an active lock from the
  // active lock list to accommodate for a possible running refresh timer
  public deleteMyLockDelaySecs = 1;
  public lockTable: string = '';

  private dbClient: DynamoDB.DocumentClient;
  private milliSecsPerSecs = 1000;

  private blockingLocks: Map<string, DynamoDBLock> = new Map<string, DynamoDBLock>();
  private myActiveLocks: Map<string, DynamoDBLock> = new Map<string, DynamoDBLock>();
  private myActiveLockTimers: Map<string, ReturnType<typeof setTimeout> | number> = new Map<
    string,
    ReturnType<typeof setTimeout> | number
  >();

  constructor(aDbClient: DynamoDB.DocumentClient, aLockTableName: string) {
    if (!aDbClient) {
      throw new Error('aDynamoDbDocumentClient is a reqiured parameter.');
    }
    if (!aLockTableName) {
      throw new Error('aLockTableName is a reqiured parameter.');
    }
    this.dbClient = aDbClient;
    this.lockTable = aLockTableName;
    this.myLockUUID = this.uuid();
  }

  public uuid() {
    return uuidv1();
  }

  public getItem(params: any, callback: (err: any, data: any) => void) {
    try {
      const dbg = Debug('getItem');

      this.dbClient.get(params, (err: any, data: any) => {
        if (err) {
          callback(`Failed to get item: ${err}`, null);
        } else {
          dbg('Got item: %O', data);
          callback(null, data);
        }
      });
    } catch (err) {
      throw new Error(`Unexpected error while trying to get DynamoDb item": ${err}`);
    }
  }

  public putItem(params: any, callback: (err: any, data: any) => void) {
    try {
      const dbg = Debug('putItem');

      this.dbClient.put(params, (err: any, data: any) => {
        if (err) {
          callback(`Failed to add item: ${err}`, null);
        } else {
          dbg('Added item: %O', data);
          callback(null, data);
        }
      });
    } catch (err) {
      throw new Error(`Unexpected error while trying to put DynamoDb item": ${err}`);
    }
  }

  public updateItem(params: any, callback: (err: any, data: any) => void) {
    try {
      const dbg = Debug('updateItem');

      this.dbClient.update(params, (err: any, data: any) => {
        if (err) {
          callback(err, null);
        } else {
          dbg('Updated item: %O', data);
          callback(null, data);
        }
      });
    } catch (err) {
      throw new Error(`Unexpected error while trying to update DynamoDb item": ${err}`);
    }
  }

  public deleteItem(params: any, callback: (err: any, data: any) => void) {
    try {
      const dbg = Debug('deleteItem');

      this.dbClient.delete(params, (err: any, data: any) => {
        if (err) {
          callback(`Failed to delete item: ${err}`, null);
        } else {
          dbg('Deleted item: %O', data);
          callback(null, data);
        }
      });
    } catch (err) {
      throw new Error(`Unexpected error while trying to delete DynamoDb item": ${err}`);
    }
  }

  /**
   * Kill the given lock's heartbeat (cancels the associated interval timer).
   * return: none
   */
  public killLockHeartbeat(aLockKey: string) {
    try {
      const dbg = Debug('killLockHeartbeat');
      if (this.myActiveLockTimers.has(aLockKey)) {
        dbg('Clearing interval timer for lock "%s"', aLockKey);
        const lockInterval = this.myActiveLockTimers.get(aLockKey);
        clearInterval(lockInterval as ReturnType<typeof setTimeout>);
        this.myActiveLockTimers.delete(aLockKey);
      }
    } catch (err) {
      throw new Error(`Unexpected error while trying to kill interval timer for lock "${aLockKey}": ${err}`);
    }
  }
  /**
   * Releases one of my active locks based on a given lock key. If the given lock is not active then callback gives null values.
   * callback:
   *      err: an error if a database error occurred
   *      data: the item attributes of the deleted item
   * DynamoDB API: https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/DynamoDB.html#deleteItem-property
   */
  public releaseMyLock(aLockKey: string, callback: (err: any, data: any) => void) {
    try {
      const dbg = Debug('releaseMyLock');

      const table = this.lockTable;

      if (this.myActiveLocks.has(aLockKey)) {
        this.killLockHeartbeat(aLockKey);
        const releasedLock = this.myActiveLocks.get(aLockKey);
        if (releasedLock) {
          // give a sec for any possible running timer sessions to complete before purging the data
          setTimeout(() => {
            this.myActiveLocks.delete(aLockKey);
          }, this.deleteMyLockDelaySecs * this.milliSecsPerSecs);

          const ddbDelTableItem = {
            ConditionExpression: 'createdByUUID = :aUUID',
            ExpressionAttributeValues: { ':aUUID': releasedLock.createdByUUID },
            Key: {
              lkey: aLockKey,
            },
            ReturnValue: 'ALL_OLD',
            TableName: table,
          };

          // Call DynamoDB.deleteItem to delete an item in the table
          this.deleteItem(ddbDelTableItem, (delErr: any, delData: any) => {
            if (delErr) {
              callback(
                `Failed to delete database lock "${aLockKey}":` +
                  ` ${delErr}: payload: ${JSON.stringify(ddbDelTableItem, null, 2)}`,
                null,
              );
            } else {
              dbg('Cleared "%s" lock: %O', aLockKey, delData);
              callback(null, releasedLock);
            }
          });
        }
      }
    } catch (err) {
      callback(`Unexpected error while trying to release my lock "${aLockKey}": ${err}`, null);
    }
  }

  /**
   * Add given lock to my watch list for blocking locks.
   *  @param aLockKey: the name of the lock
   *  @param dbLockItem: the lock data retrieved from DynamoDB as an Item object
   *  @param callback:
   *      err: an error if a database error occurred
   *      data: the item attributes of the deleted item
   */
  public addDbItemToWatchList(aLockKey: string, dbLockItem: any, callback: (err: any, data: any) => void) {
    try {
      const dbg = Debug('addDbItemToWatchList');
      // check if createdByUUID is non-empty which means that
      // the lock exists... if we just got back an empty object
      // then that means no lock exists
      if (dbLockItem && dbLockItem.createdByUUID && dbLockItem.createdByUUID.length > 0) {
        dbg('Given database lock item: $O', dbLockItem);
        // previously, this lock was changed prior to us trying to take it over, so
        // now we are just going to record it so we can see if it has expired the next
        // time we are asked to try to lock it
        const blockingLock: DynamoDBLock = {
          createdAt: dbLockItem.createdAt,
          createdByHost: dbLockItem.createdByHost,
          createdByUUID: dbLockItem.createdByUUID,
          createdByUser: dbLockItem.createdByUser,
          lkey: aLockKey,
          lockExpireSecs: dbLockItem.lockExpireSecs,
          lockVersionNum: dbLockItem.lockVersionNum,
          ttl: Date.now() + this.lockSecsToLive,
        };
        dbg('Adding blocking DynamoDBLock object to watch list: $O', blockingLock);
        this.blockingLocks.set(aLockKey, blockingLock);

        // now that we've recorded the current expected expiration time of the lock
        // we can exit and wait until we try to lock it again...
        callback(null, this.blockingLocks.get(aLockKey));
      }
    } catch (err) {
      callback(`Unexpected error while trying to add dbItem for lock "${aLockKey}" to my watch list : ${err}`, null);
    }
  }

  public getAndWatchBlockingLockOrCreate(aLockKey: string, callback: (err: any, lock: DynamoDBLock | null) => void) {
    try {
      const dbg = Debug('getAndWatchBlockingLockOrCreate');
      const ddbGetTableItem = {
        Key: {
          lkey: aLockKey,
        },
        TableName: this.lockTable,
      };
      dbg('ddbGetTableItem=%O', ddbGetTableItem);
      this.getItem(ddbGetTableItem, (getErr: any, getData: any) => {
        if (getErr) {
          dbg('Failed to search for existing lock "%s": %O', aLockKey, getErr);
          callback(getErr, null);
        } else {
          dbg('Found existing lock "%s": %O', aLockKey, getData);
          // check if we found something...
          if (getData && getData.Item && getData.Item.createdByUUID && getData.Item.createdByUUID.length > 0) {
            // if we found a lock, then add it to the lock watch list
            this.addDbItemToWatchList(aLockKey, getData.Item, callback);
          } else {
            dbg('No existing lock "%s" found: %O', aLockKey, getData);
            // when the calling routine initially tried to place this lock,
            // the lock had already been extended or re-locked by another user by the time we tried to do an upsert,
            // (that's how we ended in this routine, getAndWatchBlockingLockOrCreate)
            // but since that last attempt the lock has been deleted, so just try the upsert again
            // in order to create a branch new lock
            this.setLock(aLockKey, callback);
          }
        }
      });
    } catch (err) {
      callback(`Unexpected error while trying to get/watch/add lock "${aLockKey}" to my watch list : ${err}`, null);
    }
  }

  /**
   * NOTE: intended to be called from within a timer or interval (i.e. a separate process)
   * Wraps an interval calling of "refreshLock" that just logs results returned in callback
   * @param aLockKey the key of the lock being refreshed
   * Throws Error if something unexpected occurs which only terminates the current timer/interval process.
   * If called from within an interval, then Throw Error terminates the current interval while future intervals will still be executed.
   */
  public refreshLockCalledByInterval(aLockKey: string) {
    try {
      const dbg = Debug('callRefresher');
      if (!this.myActiveLocks.has(aLockKey)) {
        dbg('This active lock has been released, so kill its interval timer');
        this.killLockHeartbeat(aLockKey);
      } else {
        dbg('calling refreshLock("%s")...', aLockKey);

        this.refreshLock(aLockKey, (err: any, data: any) => {
          if (err) {
            throw new Error(`Failed to refresh lock "${aLockKey}": ${JSON.stringify(err, null, 2)}`);
            // TODO: if we lose connectivity the lock will soon expire, but how to handle this scenario here?
            // TODO: if another process irreverently removes or replaces our lock in the database, handle it here.
          } else {
            dbg('Refreshed lock "%s":', aLockKey, data);
          }
        });
      }
    } catch (err) {
      throw new Error(`Unexpected error while trying to get/watch/add lock "${aLockKey}" to my watch list : ${err}`);
    }
  }

  public createIntervalForLock(aLockKey: string) {
    try {
      const dbg = Debug('createIntervalForLock');
      // has an interval already been created for this active lock?
      if (!this.myActiveLockTimers.has(aLockKey)) {
        // if this lock has not had an interval creaeted yet, then set an interval refresh timer
        // to refresh this lock and keep it active until it is deleted from myActiveLocks
        dbg('Starting timer interval to refresh lock "%s" every %s secs...', aLockKey, this.lockRefreshSecs);
        this.myActiveLockTimers.set(
          aLockKey,
          setInterval(() => {
            this.refreshLockCalledByInterval(aLockKey);
          }, this.lockRefreshSecs * this.milliSecsPerSecs),
        );
      } else {
        dbg('No interval to create for lock "%s" since it should already exist', aLockKey);
      }
    } catch (err) {
      throw new Error(`Unexpected error while trying to create interval for lock "${aLockKey}": ${err}`);
    }
  }

  /**
   * Once a new/existing database lock is created/updated we record this active lock
   * in our local list of our active locks.
   * @param lockDatabaseAttributes the Attributes object returned from a DynamoDB database update run with ReturnValues=ALL_NEW
   * @returns the DynamoDBLock object recorded in myActiveLocks list
   */
  public recordMyUpdatedLock(lockDatabaseAttributes: any): DynamoDBLock | null {
    try {
      const dbg = Debug('recordMyUpdatedLock');
      let activeLock: DynamoDBLock | null = null;
      if (lockDatabaseAttributes) {
        dbg('lockDatabaseAttributes=%O', lockDatabaseAttributes);
        const lockKey = lockDatabaseAttributes.lkey;
        // now that I own this lock, remove it from the list of watched locks
        if (this.blockingLocks.has(lockKey)) {
          dbg('Delete lock "%s" from watch list...', lockKey);
          this.blockingLocks.delete(lockKey);
        }
        activeLock = {
          createdAt: lockDatabaseAttributes.createdAt,
          createdByHost: lockDatabaseAttributes.createdByHost,
          createdByUUID: lockDatabaseAttributes.createdByUUID,
          createdByUser: lockDatabaseAttributes.createdByUser,
          lkey: lockDatabaseAttributes.lkey,
          lockExpireSecs: lockDatabaseAttributes.lockExpireSecs,
          lockVersionNum: lockDatabaseAttributes.lockVersionNum,
          ttl: lockDatabaseAttributes.ttl,
        };
        dbg('Add DynamoDBLock to our list of active locks: $O', activeLock);
        this.myActiveLocks.set(lockKey, activeLock);
        // create timer only after lock has been added to the list of active locks since the timer uses the data in that list
        this.createIntervalForLock(lockKey);
      } else {
        dbg('lockDatabaseAttributes parameter not provided, so do nothing and exit');
      }
      return activeLock;
    } catch (err) {
      throw new Error(`Unexpected error while trying to record updated lock: ${err}`);
    }
  }

  public setLock(aLockKey: string, callback: (err: any, lock: DynamoDBLock | null) => void) {
    try {
      const dbg = Debug('setLock');
      let existingUUID: string | null = null;
      let existingVersionNum: number = -1;
      const now: number = Date.now();

      const newTtl: number = now + this.lockSecsToLive; // default value of "not exipired"
      let blockingLockExpired: boolean = false;
      let aNewVersionNum = 0;
      const myActiveLock = this.myActiveLocks.get(aLockKey);
      const blockingLock = this.blockingLocks.get(aLockKey);

      if (myActiveLock) {
        dbg('myActiveLock=%O', myActiveLock);
        // if this is a refresh request for an active lock that I own...
        existingUUID = myActiveLock.createdByUUID;
        existingVersionNum = myActiveLock.lockVersionNum;
        // increment the version to extend it and keep it active
        aNewVersionNum = existingVersionNum + 1;
      } else if (blockingLock) {
        dbg('blockingLock=%O', blockingLock);
        // if this is someone else's lock...
        existingUUID = blockingLock.createdByUUID;
        existingVersionNum = blockingLock.lockVersionNum;
        // the following boolean will be used within the DynamoDB query condition expression to
        // determine whether to allow the existing lock to be updated or not
        blockingLockExpired = blockingLock.ttl < now;
      }

      const ddbUpdateTableItem = {
        ConditionExpression:
          'attribute_not_exists(createdByUUID) ' + // if lock doesn't exist...
          ' OR (    createdByUUID = :existingUUID ' + // OR... lock ID hasn't changed since last checked
          '     AND lockVersionNum = :existingVersionNum ' + // AND lock ver # hasn't changed since last checked
          '     AND (   :blockingLockExpired = :true ' + // AND lock has expired (for blocking locks)
          '          OR createdByUUID = :newUUID))', // OR this is my lock
        ExpressionAttributeNames: {
          '#ttl': 'ttl',
        },
        ExpressionAttributeValues: {
          ':blockingLockExpired': blockingLockExpired,
          ':existingUUID': existingUUID,
          ':existingVersionNum': existingVersionNum,
          ':lockExpireSecs': this.lockSecsToLive,
          ':newTtl': newTtl,
          ':newUUID': this.myLockUUID,
          ':newVersionNum': aNewVersionNum,
          ':true': true,
        },
        Key: { lkey: aLockKey },
        ReturnValues: 'ALL_NEW',
        TableName: this.lockTable,
        UpdateExpression:
          'SET createdByUUID = :newUUID, ' +
          'lockVersionNum = :newVersionNum, ' +
          'lockExpireSecs = :lockExpireSecs, ' +
          '#ttl = :newTtl',
      };
      dbg('ddbUpdateTableItem=%O', ddbUpdateTableItem);

      if (
        myActiveLock && // if this is a refresh request for an active lock I own
        !this.myActiveLocks.has(aLockKey)
      ) {
        // and the lock has been canceled since this timer started
        dbg('Refresh canceled...ignore.');
        callback(null, null);
      } else {
        this.updateItem(ddbUpdateTableItem, (upErr: any, upData: any) => {
          if (upErr) {
            dbg('Failed to replace lock "%s": ', aLockKey, upErr);
            if (upErr.code === 'ConditionalCheckFailedException') {
              // this basically means that the lock that we were trying to update has been changed...
              // either it was re-created by another user (new UUID)
              // or extended (new version #) since we last checked it
              dbg('Take note of the existing lock "%s" and check it again later for possible expiration', aLockKey);
              this.getAndWatchBlockingLockOrCreate(aLockKey, (watchErr, watchLock) => {
                if (watchErr) {
                  callback(`Failed to record conflicting lock: ${JSON.stringify(watchErr, null, 2)}`, null);
                } else {
                  dbg('Recorded conflicting lock: $O', watchLock);
                  callback(null, watchLock);
                }
              });
            }
          } else {
            dbg('Updated existing lock "%s" in database to: $O', aLockKey, upData);
            const upLock: DynamoDBLock | null = this.recordMyUpdatedLock(upData.Attributes);
            callback(null, upLock);
          }
        });
      }
    } catch (err) {
      throw new Error(`Unexpected error while trying to set lock "${aLockKey}": ${err}`);
    }
  }

  public refreshLock(aLockKey: string, callback: (err: any, data: any) => void) {
    try {
      const dbg = Debug('refreshLock');
      if (this.myActiveLocks.has(aLockKey)) {
        dbg('Refresh lock "%s" by calling setLock() for one of my active locks', aLockKey);
        this.setLock(aLockKey, callback);
      }
    } catch (err) {
      throw new Error(`Unexpected error while trying to refresh lock "${aLockKey}": ${err}`);
    }
  }
}
