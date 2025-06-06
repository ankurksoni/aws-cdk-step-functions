#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { InfrastructureStack } from '../lib/infrastructure-stack';

// Declare process global for Node.js environment access
declare const process: {
  env: {
    CDK_DEFAULT_ACCOUNT?: string;
    CDK_DEFAULT_REGION?: string;
  };
};

const app = new cdk.App();
new InfrastructureStack(app, 'InfrastructureStack', {
  /* Specify the environment to enable bootstrapping and deployment.
   * This uses the AWS CLI configuration (profile, region) currently active. */
  env: { 
    account: process.env.CDK_DEFAULT_ACCOUNT, 
    region: process.env.CDK_DEFAULT_REGION 
  },

  /* Alternative: Uncomment the next line if you know exactly what Account and Region you
   * want to deploy the stack to. */
  // env: { account: '123456789012', region: 'us-east-1' },

  /* For more information, see https://docs.aws.amazon.com/cdk/latest/guide/environments.html */
});