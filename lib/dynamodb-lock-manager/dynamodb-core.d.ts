export declare class DynamoDBCore {
    AWS: any;
    private awsConfig;
    constructor(aAWS: any);
    /**
     * Use this when running code locally on your computer to get the AWS credentials from ~/.aws/credentials
     * @param awsProfileName
     */
    useAwsCredentialsFromFile(awsRegion: string, awsProfileName: string): void;
    /**
     * Use this when running code from within a browser or mobile app
     * to get the AWS credentials from AWS Cognito using a Google OAuth login ID token
     */
    useAwsCredentialsFromCognito(awsRegion: string, awsCognitoIdentityPoolId: string, googleOAuthIdToken: string): void;
}
