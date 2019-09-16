"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var debug_1 = __importDefault(require("debug"));
var debug = debug_1.default('dynamodb-core');
var DynamoDBCore = /** @class */ (function () {
    function DynamoDBCore(aAWS) {
        this.AWS = aAWS;
    }
    /**
     * Use this when running code locally on your computer to get the AWS credentials from ~/.aws/credentials
     * @param awsProfileName
     */
    DynamoDBCore.prototype.useAwsCredentialsFromFile = function (awsRegion, awsProfileName) {
        try {
            var dbg = debug_1.default('useCredentialsFromFile');
            if (!this.AWS.config.credentials) {
                var awsCredentials = new this.AWS.SharedIniFileCredentials({ profile: awsProfileName });
                dbg('awsCredentials=%O', awsCredentials);
                this.awsConfig = new this.AWS.Config({ awsCredentials: awsCredentials, awsRegion: awsRegion });
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
            var dbg = debug_1.default('useAwsCredentialsFromCognito');
            if (!this.AWS.config.credentials) {
                // ensure that this is being called from within the expected environment
                // by checking that the expected function is actually a function
                if (typeof this.AWS.CognitoIdentityCredentials === 'function') {
                    // Add the Google access token to the Cognito credentials login map.
                    var awsCredentials = new this.AWS.CognitoIdentityCredentials({
                        IdentityPoolId: awsCognitoIdentityPoolId,
                        Logins: {
                            'accounts.google.com': googleOAuthIdToken,
                        },
                    });
                    dbg('awsCredentials=%O', awsCredentials);
                    this.awsConfig = new this.AWS.Config({ awsCredentials: awsCredentials, awsRegion: awsRegion });
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
