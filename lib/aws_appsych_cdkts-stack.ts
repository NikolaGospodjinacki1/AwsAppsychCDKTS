import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Stack, StackProps } from 'aws-cdk-lib';   
import { aws_appsync as appsync } from 'aws-cdk-lib';
import { aws_cognito as cognito} from 'aws-cdk-lib';
import { aws_dynamodb as ddb } from 'aws-cdk-lib';
import { aws_lambda as lambda} from 'aws-cdk-lib'; 
import * as appsync_alpha from '@aws-cdk/aws-appsync-alpha';  
import * as dotenv from 'dotenv'
dotenv.config()

export class AwsAppsychCdktsStack  extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const userPool = new cognito.UserPool(this, 'cdk-products-user-pool', {
      selfSignUpEnabled: true,
      accountRecovery: cognito.AccountRecovery.PHONE_AND_EMAIL,
      userVerification: {
        emailStyle: cognito.VerificationEmailStyle.CODE
      },
      autoVerify: {
        email: true
      },
      standardAttributes: {
        email: {
          required: true,
          mutable: true
        }
      }
    })

    const userPoolClient = new cognito.UserPoolClient(this, "UserPoolClient", {
      userPool
    })

    const api = new appsync_alpha.GraphqlApi(this, 'cdk-product-app', {
      name: "cdk-product-api",
      logConfig: {
        fieldLogLevel: appsync_alpha.FieldLogLevel.ALL,
      },
      schema: appsync_alpha.Schema.fromAsset('./graphql/schema.graphql'),
      authorizationConfig: {
        defaultAuthorization: {
          authorizationType: appsync_alpha.AuthorizationType.API_KEY,
          apiKeyConfig: {
            expires: cdk.Expiration.after(cdk.Duration.days(365))
          }
        },
        additionalAuthorizationModes: [{
          authorizationType: appsync_alpha.AuthorizationType.USER_POOL,
          userPoolConfig: {
            userPool,
          }
        }]
      },
    })

    const productLambda = new lambda.Function(this, 'AppSyncProductHandler', {
      runtime: lambda.Runtime.NODEJS_14_X,
      handler: 'main.handler',
      code: lambda.Code.fromAsset('lambda-fns'),
      memorySize: 1024
    })
    
    // Set the new Lambda function as a data source for the AppSync API
    const lambdaDs = api.addLambdaDataSource('lambdaDatasource', productLambda)

    lambdaDs.createResolver({
      typeName: "Query",
      fieldName: "getProductById"
    })
    
    lambdaDs.createResolver({
      typeName: "Query",
      fieldName: "listProducts"
    })
    
    lambdaDs.createResolver({
      typeName: "Query",
      fieldName: "productsByCategory"
    })
    
    lambdaDs.createResolver({
      typeName: "Mutation",
      fieldName: "createProduct"
    })
    
    lambdaDs.createResolver({
      typeName: "Mutation",
      fieldName: "deleteProduct"
    })
    
    lambdaDs.createResolver({
      typeName: "Mutation",
      fieldName: "updateProduct"
    })
    
    const productTable = new ddb.Table(this, 'CDKProductTable', {
      billingMode: ddb.BillingMode.PAY_PER_REQUEST,
      partitionKey: {
        name: 'id',
        type: ddb.AttributeType.STRING,
      },
    })
    
    // Add a global secondary index to enable another data access pattern
    productTable.addGlobalSecondaryIndex({
      indexName: "productsByCategory",
      partitionKey: {
        name: "category",
        type: ddb.AttributeType.STRING,
      }
    })
    
    // Enable the Lambda function to access the DynamoDB table (using IAM)
    productTable.grantFullAccess(productLambda)
    
    // Create an environment variable that we will use in the function code
    productLambda.addEnvironment('PRODUCT_TABLE', productTable.tableName)


new cdk.CfnOutput(this, "GraphQLAPIURL", {
  value: api.graphqlUrl
})

new cdk.CfnOutput(this, "AppSychAPIKey", {
  value: api.apiKey || ''
})

new cdk.CfnOutput(this, "ProjectRegion", {
  value: this.region
})

new cdk.CfnOutput(this, "UserPoolId", {
  value: userPool.userPoolId
})

new cdk.CfnOutput(this, "UserPoolClientId", {
  value: userPoolClient.userPoolClientId
})

  }
}
