import { DynamoDBLock } from '../index';
const uuidv1 = require('uuid/v1');
const os = require('os');

test('DynamoDBLock', () => {
  let lkey = 'testLock';
  let createdByUUID = uuidv1();
  let lockVersionNum = 2;
  let lockExpireSecs = 5;
  let createdByHost = os.hostname();
  let createdByUser = os.userInfo().username;
  let createdAt = new Date();
  let ttl = Date.now() + 5; // 5 seconds in the future

  expect(
    new DynamoDBLock(lkey, createdByUUID, lockVersionNum, lockExpireSecs, createdByHost, createdByUser, createdAt, ttl)
      .createdByUUID,
  ).toBe(createdByUUID);
});
