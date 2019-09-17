import { DynamoDBLock } from './dynamodb-lock';
import { DynamoDB } from 'aws-sdk';
export declare class DynamoDBLockManager {
    myLockUUID: string;
    lockSecsToLive: number;
    lockRefreshSecs: number;
    deleteMyLockDelaySecs: number;
    lockTable: string;
    private dbClient;
    private milliSecsPerSecs;
    private blockingLocks;
    private myActiveLocks;
    private myActiveLockTimers;
    constructor(aDbClient: DynamoDB.DocumentClient, aLockTableName: string);
    uuid(): string;
    getItem(params: any, callback: (err: any, data: any) => void): void;
    putItem(params: any, callback: (err: any, data: any) => void): void;
    updateItem(params: any, callback: (err: any, data: any) => void): void;
    deleteItem(params: any, callback: (err: any, data: any) => void): void;
    /**
     * Kill the given lock's heartbeat (cancels the associated interval timer).
     * return: none
     */
    killLockHeartbeat(aLockKey: string): void;
    /**
     * Releases one of my active locks based on a given lock key. If the given lock is not active then callback gives null values.
     * callback:
     *      err: an error if a database error occurred
     *      data: the item attributes of the deleted item
     * DynamoDB API: https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/DynamoDB.html#deleteItem-property
     */
    releaseMyLock(aLockKey: string, callback: (err: any, data: any) => void): void;
    /**
     * Add given lock to my watch list for blocking locks.
     *  @param aLockKey: the name of the lock
     *  @param dbLockItem: the lock data retrieved from DynamoDB as an Item object
     *  @param callback:
     *      err: an error if a database error occurred
     *      data: the item attributes of the deleted item
     */
    addDbItemToWatchList(aLockKey: string, dbLockItem: any, callback: (err: any, data: any) => void): void;
    getAndWatchBlockingLockOrCreate(aLockKey: string, callback: (err: any, lock: DynamoDBLock | null) => void): void;
    /**
     * NOTE: intended to be called from within a timer or interval (i.e. a separate process)
     * Wraps an interval calling of "refreshLock" that just logs results returned in callback
     * @param aLockKey the key of the lock being refreshed
     * Throws Error if something unexpected occurs which only terminates the current timer/interval process.
     * If called from within an interval, then Throw Error terminates the current interval while future intervals will still be executed.
     */
    refreshLockCalledByInterval(aLockKey: string): void;
    createIntervalForLock(aLockKey: string): void;
    /**
     * Once a new/existing database lock is created/updated we record this active lock
     * in our local list of our active locks.
     * @param lockDatabaseAttributes the Attributes object returned from a DynamoDB database update run with ReturnValues=ALL_NEW
     * @returns the DynamoDBLock object recorded in myActiveLocks list
     */
    recordMyUpdatedLock(lockDatabaseAttributes: any): DynamoDBLock | null;
    setLock(aLockKey: string, callback: (err: any, lock: DynamoDBLock | null) => void): void;
    refreshLock(aLockKey: string, callback: (err: any, data: any) => void): void;
}
