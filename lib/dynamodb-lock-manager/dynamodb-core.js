"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var debug = require('debug')('dynamodb-core');
require('aws-sdk');
var DynamoDBCore = /** @class */ (function () {
    function DynamoDBCore(AWS) {
        this.AWS = AWS;
    }
    /**
    * Use this when running code locally on your computer to get the AWS credentials from ~/.aws/credentials
     * @param awsProfileName
     */
    DynamoDBCore.prototype.useAwsCredentialsFromFile = function (awsRegion, awsProfileName) {
        try {
            var dbg = debug('useCredentialsFromFile');
            if (!this.AWS.config.credentials) {
                var awsCredentials = new this.AWS.SharedIniFileCredentials({ profile: awsProfileName });
                dbg('awsCredentials=%O', awsCredentials);
                this.awsConfig = new this.AWS.Config({
                    awsRegion: awsRegion,
                    credentials: awsCredentials
                });
            }
        }
        catch (err) {
            throw new Error("Unexpected error while trying to get AWS credentials from file: " + err);
        }
    };
    /**
     * Use this when running code from within a browser or mobile app
     * to get the AWS credentials from AWS Cognito using a Google OAuth login ID token
     */
    DynamoDBCore.prototype.useAwsCredentialsFromCognito = function (awsRegion, awsCognitoIdentityPoolId, googleOAuthIdToken) {
        try {
            var dbg = debug('useAwsCredentialsFromCognito');
            if (!this.AWS.config.credentials) {
                // ensure that this is being called from within the expected environment 
                // by checking that the expected function is actually a function
                if (typeof this.AWS.CognitoIdentityCredentials === 'function') {
                    // Add the Google access token to the Cognito credentials login map.
                    var awsCredentials = new this.AWS.CognitoIdentityCredentials({
                        IdentityPoolId: awsCognitoIdentityPoolId,
                        Logins: {
                            'accounts.google.com': googleOAuthIdToken
                        }
                    });
                    dbg('awsCredentials=%O', awsCredentials);
                    this.awsConfig = new this.AWS.Config({
                        awsRegion: awsRegion,
                        credentials: awsCredentials
                    });
                }
            }
        }
        catch (err) {
            throw new Error("Unexpected error while trying to get AWS credentials from Cognito: " + err);
        }
    };
    return DynamoDBCore;
}());
exports.DynamoDBCore = DynamoDBCore;
