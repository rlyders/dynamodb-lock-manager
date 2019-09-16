export declare class DynamoDBLock {
    lkey: string;
    createdByUUID: string;
    lockVersionNum: number;
    lockExpireSecs: number;
    createdByHost: string;
    createdByUser: string;
    createdAt: Date;
    ttl: number;
    constructor(aLkey: string, aCreatedByUUID: string, aLockVersionNum: number, aLockExpireSecs: number, aCreatedByHost: string, aCreatedByUser: string, aCreatedAt: Date, aTtl: number);
}
