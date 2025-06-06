import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as stepfunctions from 'aws-cdk-lib/aws-stepfunctions';
import * as sfnTasks from 'aws-cdk-lib/aws-stepfunctions-tasks';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';
import { StepFunctionConfig, EventBridgeConfig } from '@repo/types';

export class InfrastructureStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Configuration following Single Responsibility Principle
    const stepFunctionConfig: StepFunctionConfig = {
      name: 'DataMigrationWorkflow',
      timeout: 300, // 5 minutes
      retryAttempts: 3,
    };

    const eventBridgeConfig: EventBridgeConfig = {
      ruleName: 'DataMigrationSchedule',
      scheduleExpression: 'rate(5 minutes)',
      description: 'Triggers data migration workflow every 5 minutes',
    };

    // Create Lambda function for workflow execution
    const workflowLambda = this.createWorkflowLambda();
    
    // Create Step Function state machine
    const stateMachine = this.createStateMachine(workflowLambda, stepFunctionConfig);
    
    // Create EventBridge rule to trigger Step Function
    this.createEventBridgeRule(stateMachine, eventBridgeConfig);

    // Output important resources
    new cdk.CfnOutput(this, 'StateMachineArn', {
      value: stateMachine.stateMachineArn,
      description: 'ARN of the Step Function state machine',
    });

    new cdk.CfnOutput(this, 'WorkflowLambdaFunctionName', {
      value: workflowLambda.functionName,
      description: 'Name of the workflow Lambda function',
    });
  }

  // Single Responsibility: Lambda creation
  private createWorkflowLambda(): lambda.Function {
    const workflowLambda = new lambda.Function(this, 'WorkflowLambda', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.workflowHandler',
      code: lambda.Code.fromAsset('../../packages/lambda-handlers/dist'),
      timeout: cdk.Duration.minutes(5),
      memorySize: 512,
      environment: {
        NODE_ENV: 'production',
        LOG_LEVEL: 'INFO',
      },
      // Enhanced monitoring and tracing
      tracing: lambda.Tracing.ACTIVE,
      logRetention: logs.RetentionDays.ONE_WEEK,
    });

    // Add necessary permissions for Lambda Powertools
    workflowLambda.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'xray:PutTraceSegments',
          'xray:PutTelemetryRecords',
        ],
        resources: ['*'],
      })
    );

    return workflowLambda;
  }

  // Single Responsibility: Step Function creation
  private createStateMachine(
    workflowLambda: lambda.Function,
    config: StepFunctionConfig
  ): stepfunctions.StateMachine {
    // Define the workflow steps
    const startWorkflow = new sfnTasks.LambdaInvoke(this, 'StartWorkflow', {
      lambdaFunction: workflowLambda,
      payloadResponseOnly: true,
      retryOnServiceExceptions: true,
    });

    // Add error handling and retry logic
    const errorHandler = new stepfunctions.Fail(this, 'WorkflowFailed', {
      cause: 'Workflow execution failed',
      error: 'WorkflowError',
    });

    const successState = new stepfunctions.Succeed(this, 'WorkflowSucceeded', {
      comment: 'Workflow completed successfully',
    });

    // Define the state machine definition with error handling
    const definition = startWorkflow
      .addCatch(errorHandler, {
        errors: ['States.ALL'],
        resultPath: '$.error',
      })
      .next(
        new stepfunctions.Choice(this, 'CheckWorkflowResult')
          .when(
            stepfunctions.Condition.booleanEquals('$.success', true),
            successState
          )
          .otherwise(errorHandler)
      );

    // Create the state machine
    const stateMachine = new stepfunctions.StateMachine(this, 'DataMigrationStateMachine', {
      definition,
      stateMachineName: config.name,
      timeout: cdk.Duration.seconds(config.timeout),
      // Enhanced logging
      logs: {
        destination: new logs.LogGroup(this, 'StateMachineLogGroup', {
          logGroupName: `/aws/stepfunctions/${config.name}`,
          retention: logs.RetentionDays.ONE_WEEK,
        }),
        level: stepfunctions.LogLevel.ALL,
        includeExecutionData: true,
      },
      // Enable X-Ray tracing
      tracingEnabled: true,
    });

    return stateMachine;
  }

  // Single Responsibility: EventBridge rule creation
  private createEventBridgeRule(
    stateMachine: stepfunctions.StateMachine,
    config: EventBridgeConfig
  ): events.Rule {
    // Create EventBridge rule for scheduled execution
    const rule = new events.Rule(this, 'ScheduledWorkflowRule', {
      ruleName: config.ruleName,
      description: config.description,
      schedule: events.Schedule.expression(config.scheduleExpression),
    });

    // Add the Step Function as a target
    rule.addTarget(
      new targets.SfnStateMachine(stateMachine, {
        input: events.RuleTargetInput.fromObject({
          executionId: events.EventField.fromPath('$.id'),
          timestamp: events.EventField.fromPath('$.time'),
          data: {
            triggerSource: 'EventBridge',
            ruleName: config.ruleName,
          },
        }),
      })
    );

    return rule;
  }
}
