export declare class DynamoDBLock {
    lkey: string;
    createdByUUID: string;
    lockVersionNum: number;
    lockExpireSecs: number;
    createdByHost: string;
    createdByUser: string;
    createdAt: Date;
    ttl: number;
    constructor(lkey: string, createdByUUID: string, lockVersionNum: number, lockExpireSecs: number, createdByHost: string, createdByUser: string, createdAt: Date, ttl: number);
}
