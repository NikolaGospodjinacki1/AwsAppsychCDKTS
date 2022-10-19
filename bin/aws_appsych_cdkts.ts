#!/usr/bin/env node
import 'source-map-support/register';
import { Construct } from 'constructs';
import { App, Stack, StackProps } from 'aws-cdk-lib';    
import { AwsAppsychCdktsStack } from '../lib/aws_appsych_cdkts-stack';
import * as dotenv from 'dotenv'
dotenv.config()

const app = new App();
new AwsAppsychCdktsStack(app, 'AwsAppsychCdktsStack', {

    env: { account: process.env.PERSONALACCOUNT, region: process.env.REGION },

});