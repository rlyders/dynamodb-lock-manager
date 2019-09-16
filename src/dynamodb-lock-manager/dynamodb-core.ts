import Debug from 'debug';
const debug = Debug('dynamodb-core');
import aws from 'aws-sdk';

export class DynamoDBCore {
  public AWS: any;
  private awsConfig: any;

  constructor(aAWS: any) {
    this.AWS = aAWS;
  }

  /**
   * Use this when running code locally on your computer to get the AWS credentials from ~/.aws/credentials
   * @param awsProfileName
   */
  public useAwsCredentialsFromFile(awsRegion: string, awsProfileName: string) {
    try {
      const dbg = Debug('useCredentialsFromFile');
      if (!this.AWS.config.credentials) {
        const awsCredentials = new this.AWS.SharedIniFileCredentials({ profile: awsProfileName });
        dbg('awsCredentials=%O', awsCredentials);
        this.awsConfig = new this.AWS.Config({ awsCredentials, awsRegion });
      }
    } catch (err) {
      throw new Error(`Unexpected error while trying to get AWS credentials from file: ${err}`);
    }
  }

  /**
   * Use this when running code from within a browser or mobile app
   * to get the AWS credentials from AWS Cognito using a Google OAuth login ID token
   */
  public useAwsCredentialsFromCognito(awsRegion: string, awsCognitoIdentityPoolId: string, googleOAuthIdToken: string) {
    try {
      const dbg = Debug('useAwsCredentialsFromCognito');
      if (!this.AWS.config.credentials) {
        // ensure that this is being called from within the expected environment
        // by checking that the expected function is actually a function
        if (typeof this.AWS.CognitoIdentityCredentials === 'function') {
          // Add the Google access token to the Cognito credentials login map.
          const awsCredentials = new this.AWS.CognitoIdentityCredentials({
            IdentityPoolId: awsCognitoIdentityPoolId,
            Logins: {
              'accounts.google.com': googleOAuthIdToken,
            },
          });
          dbg('awsCredentials=%O', awsCredentials);
          this.awsConfig = new this.AWS.Config({ awsCredentials, awsRegion });
        }
      }
    } catch (err) {
      throw new Error(`Unexpected error while trying to get AWS credentials from Cognito: ${err}`);
    }
  }
}
