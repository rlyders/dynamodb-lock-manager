"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var dynamodb_core_1 = require("./dynamodb-core");
var debug_1 = __importDefault(require("debug"));
var debug = debug_1.default('dynamodb-lock');
var v1_1 = __importDefault(require("uuid/v1"));
var DynamoDBLockManager = /** @class */ (function (_super) {
    __extends(DynamoDBLockManager, _super);
    function DynamoDBLockManager(aAWS) {
        var _this = _super.call(this, aAWS) || this;
        _this.blockingLocks = new Map();
        _this.myActiveLocks = new Map();
        _this.myActiveLockTimers = new Map();
        _this.myLockUUID = '';
        _this.lockSecsToLive = 10; // a lock is only held for N seconds
        _this.milliSecsPerSecs = 1000;
        _this.lockRefreshSecs = _this.lockSecsToLive / 2; // we will attempt to extend each active lock at the mid-life of the lock
        // deleteMyLockDelaySecs: delay for N seconds before actually purging an active lock from the
        // active lock list to accommodate for a possible running refresh timer
        _this.deleteMyLockDelaySecs = 1;
        _this.dynaomoDbDocumentClient = null;
        _this.lockTable = '';
        _this.myLockUUID = _this.uuid();
        return _this;
    }
    DynamoDBLockManager.prototype.uuid = function () {
        return v1_1.default();
    };
    DynamoDBLockManager.prototype.getDynamoDbDocumentClient = function () {
        if (!this.dynaomoDbDocumentClient) {
            // Create the DynamoDB service object
            this.dynaomoDbDocumentClient = new this.AWS.DynamoDB.DocumentClient({ apiVersion: '2012-10-08' });
        }
        return this.dynaomoDbDocumentClient;
    };
    DynamoDBLockManager.prototype.getItem = function (params, callback) {
        try {
            var dbg_1 = debug_1.default('getItem');
            this.getDynamoDbDocumentClient().get(params, function (err, data) {
                if (err) {
                    callback("Failed to get item: " + err, null);
                }
                else {
                    dbg_1('Got item: %O', data);
                    callback(null, data);
                }
            });
        }
        catch (err) {
            throw new Error("Unexpected error while trying to get DynamoDb item\": " + err);
        }
    };
    DynamoDBLockManager.prototype.putItem = function (params, callback) {
        try {
            var dbg_2 = debug_1.default('putItem');
            this.getDynamoDbDocumentClient().put(params, function (err, data) {
                if (err) {
                    callback("Failed to add item: " + err, null);
                }
                else {
                    dbg_2('Added item: %O', data);
                    callback(null, data);
                }
            });
        }
        catch (err) {
            throw new Error("Unexpected error while trying to put DynamoDb item\": " + err);
        }
    };
    DynamoDBLockManager.prototype.updateItem = function (params, callback) {
        try {
            var dbg_3 = debug_1.default('updateItem');
            this.getDynamoDbDocumentClient().update(params, function (err, data) {
                if (err) {
                    callback("Failed to update item: " + err, null);
                }
                else {
                    dbg_3('Updated item: %O', data);
                    callback(null, data);
                }
            });
        }
        catch (err) {
            throw new Error("Unexpected error while trying to update DynamoDb item\": " + err);
        }
    };
    DynamoDBLockManager.prototype.deleteItem = function (params, callback) {
        try {
            var dbg_4 = debug_1.default('deleteItem');
            this.getDynamoDbDocumentClient().delete(params, function (err, data) {
                if (err) {
                    callback("Failed to delete item: " + err, null);
                }
                else {
                    dbg_4('Deleted item: %O', data);
                    callback(null, data);
                }
            });
        }
        catch (err) {
            throw new Error("Unexpected error while trying to delete DynamoDb item\": " + err);
        }
    };
    /**
     * Kill the given lock's heartbeat (cancels the associated interval timer).
     * return: none
     */
    DynamoDBLockManager.prototype.killLockHeartbeat = function (aLockKey) {
        try {
            var dbg = debug_1.default('killLockHeartbeat');
            dbg('Cllearing interval timer for lock "%s"', aLockKey);
            clearInterval(this.myActiveLockTimers.get(aLockKey));
            this.myActiveLockTimers.delete(aLockKey);
        }
        catch (err) {
            throw new Error("Unexpected error while trying to kill interval timer for lock \"" + aLockKey + "\": " + err);
        }
    };
    /**
     * Releases one of my active locks based on a given lock key. If the given lock is not active then callback gives null values.
     * callback:
     *      err: an error if a database error occurred
     *      data: the item attributes of the deleted item
     * DynamoDB API: https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/DynamoDB.html#deleteItem-property
     */
    DynamoDBLockManager.prototype.releaseMyLock = function (aLockKey, callback) {
        var _this = this;
        try {
            var dbg_5 = debug_1.default('releaseMyLock');
            var table = this.lockTable;
            if (this.myActiveLocks.has(aLockKey)) {
                this.killLockHeartbeat(aLockKey);
                var releasedLock_1 = this.myActiveLocks.get(aLockKey);
                if (releasedLock_1) {
                    // give a sec for any possible running timer sessions to complete before purging the data
                    setTimeout(function () {
                        _this.myActiveLocks.delete(aLockKey);
                    }, this.deleteMyLockDelaySecs * this.milliSecsPerSecs);
                    var ddbDelTableItem_1 = {
                        ConditionExpression: 'createdByUUID = :aUUID',
                        ExpressionAttributeValues: { ':aUUID': releasedLock_1.createdByUUID },
                        Key: {
                            lkey: aLockKey,
                        },
                        ReturnValue: 'ALL_OLD',
                        TableName: table,
                    };
                    // Call DynamoDB.deleteItem to delete an item in the table
                    this.deleteItem(ddbDelTableItem_1, function (delErr, delData) {
                        if (delErr) {
                            callback("Failed to delete database lock \"" + aLockKey + "\":" +
                                (" " + delErr + ": payload: " + JSON.stringify(ddbDelTableItem_1, null, 2)), null);
                        }
                        else {
                            dbg_5('Cleared "%s" lock: %O', aLockKey, delData);
                            callback(null, releasedLock_1);
                        }
                    });
                }
            }
        }
        catch (err) {
            callback("Unexpected error while trying to release my lock \"" + aLockKey + "\": " + err, null);
        }
    };
    /**
     * Add given lock to my watch list for blocking locks.
     *  @param aLockKey: the name of the lock
     *  @param dbLockItem: the lock data retrieved from DynamoDB as an Item object
     *  @param callback:
     *      err: an error if a database error occurred
     *      data: the item attributes of the deleted item
     */
    DynamoDBLockManager.prototype.addDbItemToWatchList = function (aLockKey, dbLockItem, callback) {
        try {
            var dbg = debug_1.default('addDbItemToWatchList');
            // check if createdByUUID is non-empty which means that
            // the lock exists... if we just got back an empty object
            // then that means no lock exists
            if (dbLockItem && dbLockItem.createdByUUID && dbLockItem.createdByUUID.length > 0) {
                dbg('Given database lock item: $O', dbLockItem);
                // previously, this lock was changed prior to us trying to take it over, so
                // now we are just going to record it so we can see if it has expired the next
                // time we are asked to try to lock it
                var blockingLock = {
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
        }
        catch (err) {
            callback("Unexpected error while trying to add dbItem for lock \"" + aLockKey + "\" to my watch list : " + err, null);
        }
    };
    DynamoDBLockManager.prototype.getAndWatchBlockingLockOrCreate = function (aLockKey, callback) {
        var _this = this;
        try {
            var dbg_6 = debug_1.default('getAndWatchBlockingLockOrCreate');
            var ddbGetTableItem = {
                Key: {
                    lkey: aLockKey,
                },
                TableName: this.lockTable,
            };
            dbg_6('ddbGetTableItem=%O', ddbGetTableItem);
            this.getItem(ddbGetTableItem, function (getErr, getData) {
                if (getErr) {
                    dbg_6('Failed to search for existing lock "%s": %O', aLockKey, getErr);
                    callback(getErr, null);
                }
                else {
                    dbg_6('Found existing lock "%s": %O', aLockKey, getData);
                    // check if we found something...
                    if (getData && getData.Item && getData.Item.createdByUUID && getData.Item.createdByUUID.length > 0) {
                        // if we found a lock, then add it to the lock watch list
                        _this.addDbItemToWatchList(aLockKey, getData.Item, callback);
                    }
                    else {
                        dbg_6('No existing lock "%s" found: %O', aLockKey, getData);
                        // when the calling routine initially tried to place this lock,
                        // the lock had already been extended or re-locked by another user by the time we tried to do an upsert,
                        // (that's how we ended in this routine, getAndWatchBlockingLockOrCreate)
                        // but since that last attempt the lock has been deleted, so just try the upsert again
                        // in order to create a branch new lock
                        _this.setLock(aLockKey, callback);
                    }
                }
            });
        }
        catch (err) {
            callback("Unexpected error while trying to get/watch/add lock \"" + aLockKey + "\" to my watch list : " + err, null);
        }
    };
    /**
     * NOTE: intended to be called from within a timer or interval (i.e. a separate process)
     * Wraps an interval calling of "refreshLock" that just logs results returned in callback
     * @param aLockKey the key of the lock being refreshed
     * Throws Error if something unexpected occurs which only terminates the current timer/interval process.
     * If called from within an interval, then Throw Error terminates the current interval while future intervals will still be executed.
     */
    DynamoDBLockManager.prototype.refreshLockCalledByInterval = function (aLockKey) {
        try {
            var dbg_7 = debug_1.default('callRefresher');
            dbg_7('calling refreshLock("%s")...', aLockKey);
            this.refreshLock(aLockKey, function (err, data) {
                if (err) {
                    throw new Error("Failed to refresh lock \"" + aLockKey + "\": " + JSON.stringify(err, null, 2));
                    // TODO: if we lose connectivity the lock will soon expire, but how to handle this scenario here?
                    // TODO: if another process irreverently removes or replaces our lock in the database, handle it here.
                }
                else {
                    dbg_7('Refreshed lock "%s":', aLockKey, data);
                }
            });
        }
        catch (err) {
            throw new Error("Unexpected error while trying to get/watch/add lock \"" + aLockKey + "\" to my watch list : " + err);
        }
    };
    DynamoDBLockManager.prototype.createIntervalForLock = function (aLockKey) {
        var _this = this;
        try {
            var dbg = debug_1.default('createIntervalForLock');
            // has this lock already been added to my list of active locks?
            if (!this.myActiveLocks.has(aLockKey)) {
                // if this lock is just being made active, then set an interval refresh timer
                // to refresh this lock and keep it active until it is deleted from myActiveLocks
                dbg('Starting timer interval to refresh lock "%s" every %s secs...', aLockKey, this.lockRefreshSecs);
                this.myActiveLockTimers.set(aLockKey, setInterval(function () {
                    _this.refreshLockCalledByInterval(aLockKey);
                }, this.lockRefreshSecs * this.milliSecsPerSecs));
            }
            else {
                dbg('No interval to create for lock "%s" since it should already exist', aLockKey);
            }
        }
        catch (err) {
            throw new Error("Unexpected error while trying to create interval for lock \"" + aLockKey + "\": " + err);
        }
    };
    /**
     * Once a new/existing database lock is created/updated we record this active lock
     * in our local list of our active locks.
     * @param lockDatabaseAttributes the Attributes object returned from a DynamoDB database update run with ReturnValues=ALL_NEW
     * @returns the DynamoDBLock object recorded in myActiveLocks list
     */
    DynamoDBLockManager.prototype.recordMyUpdatedLock = function (lockDatabaseAttributes) {
        try {
            var dbg = debug_1.default('recordMyUpdatedLock');
            var activeLock = null;
            if (lockDatabaseAttributes) {
                dbg('lockDatabaseAttributes=%O', lockDatabaseAttributes);
                var lockKey = lockDatabaseAttributes.lkey;
                // now that I own this lock, remove it from the list of watched locks
                if (this.blockingLocks.hasOwnProperty(lockKey)) {
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
            }
            else {
                dbg('lockDatabaseAttributes parameter not provided, so do nothing and exit');
            }
            return activeLock;
        }
        catch (err) {
            throw new Error("Unexpected error while trying to record updated lock: " + err);
        }
    };
    DynamoDBLockManager.prototype.setLock = function (aLockKey, callback) {
        var _this = this;
        try {
            var dbg_8 = debug_1.default('setLock');
            var existingUUID = '';
            var existingVersionNum = -1;
            var now = Date.now();
            var newTtl = now + this.lockSecsToLive; // default value of "not exipired"
            var blockingLockExpired = false;
            var aNewVersionNum = 0;
            var myActiveLock = this.myActiveLocks.get(aLockKey);
            var blockingLock = this.blockingLocks.get(aLockKey);
            if (myActiveLock) {
                dbg_8('myActiveLock=%O', myActiveLock);
                // if this is a refresh request for an active lock that I own...
                existingUUID = myActiveLock.createdByUUID;
                existingVersionNum = myActiveLock.lockVersionNum;
                // increment the version to extend it and keep it active
                aNewVersionNum = existingVersionNum + 1;
            }
            else if (blockingLock) {
                dbg_8('blockingLock=%O', blockingLock);
                // if this is someone else's lock...
                existingUUID = blockingLock.createdByUUID;
                existingVersionNum = blockingLock.lockVersionNum;
                // the following boolean will be used within the DynamoDB query condition expression to
                // determine whether to allow the existing lock to be updated or not
                blockingLockExpired = blockingLock.ttl < now;
            }
            var ddbUpdateTableItem = {
                ConditionExpression: 'attribute_not_exists(createdByUUID) ' + // if lock doesn't exist...
                    ' OR (    createdByUUID = :existingUUID ' + // OR... lock ID hasn't changed since last checked
                    '     AND lockVersionNum = :existingVersionNum ' + // AND lock ver # hasn't changed since last checked
                    '     AND (   :blockingLockExpired ' + // AND lock has expired (for blocking locks)
                    '          OR createdByUUID = :newUUID))',
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
                },
                Key: { lkey: aLockKey },
                ReturnValues: 'ALL_NEW',
                TableName: this.lockTable,
                UpdateExpression: 'SET createdByUUID = :newUUID, ' +
                    'lockVersionNum = :newVersionNum, ' +
                    'lockExpireSecs = :lockExpireSecs, ' +
                    '#ttl = :newTtl',
            };
            dbg_8('ddbUpdateTableItem=%O', ddbUpdateTableItem);
            if (myActiveLock && // if this is a refresh request for an active lock I own
                !this.myActiveLocks.has(aLockKey)) {
                // and the lock has been canceled since this timer started
                dbg_8('Refresh canceled...ignore.');
                callback(null, null);
            }
            else {
                this.updateItem(ddbUpdateTableItem, function (upErr, upData) {
                    if (upErr) {
                        dbg_8('Failed to replace lock "%s": ', aLockKey, upErr);
                        if (upErr.code === 'ConditionalCheckFailedException') {
                            // this basically means that the lock that we were trying to update has been changed...
                            // either it was re-created by another user (new UUID)
                            // or extended (new version #) since we last checked it
                            dbg_8('Take note of the existing lock "%s" and check it again later for possible expiration', aLockKey);
                            _this.getAndWatchBlockingLockOrCreate(aLockKey, function (watchErr, watchLock) {
                                if (watchErr) {
                                    callback("Failed to record conflicting lock: " + JSON.stringify(watchErr, null, 2), null);
                                }
                                else {
                                    dbg_8('Recorded conflicting lock: $O', watchLock);
                                    callback(null, watchLock);
                                }
                            });
                        }
                    }
                    else {
                        dbg_8('Updated existing lock "%s" in database to: $O', aLockKey, upData);
                        var upLock = _this.recordMyUpdatedLock(aLockKey);
                        callback(null, upLock);
                    }
                });
            }
        }
        catch (err) {
            throw new Error("Unexpected error while trying to set lock \"" + aLockKey + "\": " + err);
        }
    };
    DynamoDBLockManager.prototype.refreshLock = function (aLockKey, callback) {
        try {
            var dbg = debug_1.default('refreshLock');
            dbg('Refresh lock "%s" by calling setLock() for one of my active locks', aLockKey);
            this.setLock(aLockKey, callback);
        }
        catch (err) {
            throw new Error("Unexpected error while trying to refresh lock \"" + aLockKey + "\": " + err);
        }
    };
    return DynamoDBLockManager;
}(dynamodb_core_1.DynamoDBCore));
exports.DynamoDBLockManager = DynamoDBLockManager;
