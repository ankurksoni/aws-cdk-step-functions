import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import * as Infrastructure from '../lib/infrastructure-stack';

describe('Infrastructure Stack', () => {
  test('Step Function State Machine Created', () => {
    const app = new cdk.App();
    const stack = new Infrastructure.InfrastructureStack(app, 'MyTestStack');
    const template = Template.fromStack(stack);

    // Verify Step Function state machine is created
    template.hasResourceProperties('AWS::StepFunctions::StateMachine', {
      StateMachineName: 'DataMigrationWorkflow'
    });

    // Verify Lambda function is created
    template.hasResourceProperties('AWS::Lambda::Function', {
      Runtime: 'nodejs18.x'
    });

    // Verify EventBridge rule is created
    template.hasResourceProperties('AWS::Events::Rule', {
      Name: 'DataMigrationSchedule'
    });
  });
});
