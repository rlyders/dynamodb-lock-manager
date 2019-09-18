export class DynamoDBLock {
  public lkey: string;
  public createdByUUID: string;
  public lockVersionNum: number;
  public lockExpireSecs: number;
  public createdByHost: string;
  public createdByUser: string;
  public createdAt: Date | null;
  public ttl: number;

  constructor(
    aLkey: string,
    aCreatedByUUID: string,
    aLockVersionNum: number,
    aLockExpireSecs: number,
    aCreatedByHost: string,
    aCreatedByUser: string,
    aCreatedAt: Date | null,
    aTtl: number,
  ) {
    this.lkey = aLkey;
    this.createdByUUID = aCreatedByUUID;
    this.lockVersionNum = aLockVersionNum;
    this.lockExpireSecs = aLockExpireSecs;
    this.createdByHost = aCreatedByHost;
    this.createdByUser = aCreatedByUser;
    this.createdAt = aCreatedAt;
    this.ttl = aTtl;
  }
}
