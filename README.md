# dynamodb-lock-manager
NodeJS module to manage distributed locks in DynamoDB with the AWS SDK. This package allows the caller to create locks, auto-refresh locks via heartbeats, takeover expired locks, and release locks.

This work is based on concepts from following AWS Database Blog post: https://aws.amazon.com/blogs/database/building-distributed-locks-with-the-dynamodb-lock-client
