"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var DynamoDBLock = /** @class */ (function () {
    function DynamoDBLock(lkey, createdByUUID, lockVersionNum, lockExpireSecs, createdByHost, createdByUser, createdAt, ttl) {
        this.lkey = lkey;
        this.createdByUUID = createdByUUID;
        this.lockVersionNum = lockVersionNum;
        this.lockExpireSecs = lockExpireSecs;
        this.createdByHost = createdByHost;
        this.createdByUser = createdByUser;
        this.createdAt = createdAt;
        this.ttl = ttl;
    }
    return DynamoDBLock;
}());
exports.DynamoDBLock = DynamoDBLock;
