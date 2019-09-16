"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var DynamoDBLock = /** @class */ (function () {
    function DynamoDBLock(aLkey, aCreatedByUUID, aLockVersionNum, aLockExpireSecs, aCreatedByHost, aCreatedByUser, aCreatedAt, aTtl) {
        this.lkey = aLkey;
        this.createdByUUID = aCreatedByUUID;
        this.lockVersionNum = aLockVersionNum;
        this.lockExpireSecs = aLockExpireSecs;
        this.createdByHost = aCreatedByHost;
        this.createdByUser = aCreatedByUser;
        this.createdAt = aCreatedAt;
        this.ttl = aTtl;
    }
    return DynamoDBLock;
}());
exports.DynamoDBLock = DynamoDBLock;
