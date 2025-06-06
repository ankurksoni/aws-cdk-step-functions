# AWS CDK Step Functions Workflow

A simplified AWS Step Functions workflow triggered by EventBridge, built with TypeScript and AWS CDK.

## 🏗️ Architecture Overview

```
EventBridge (every 5 min) → Step Function → Lambda → Workflow Execution
```

## 📋 How It Actually Works - Step by Step

### Step 1: EventBridge Triggers the Workflow

**⏰ Every 5 minutes**, EventBridge automatically triggers the Step Function with this input:

```json
{
  "executionId": "b6c44b63-9cd4-8ae7-9da2-05b6107ad941",
  "timestamp": "2025-06-06T12:12:07Z",
  "data": {
    "triggerSource": "EventBridge",
    "ruleName": "DataMigrationSchedule"
  }
}
```

**📍 Code Reference:**
```typescript
// apps/infrastructure/lib/infrastructure-stack.ts - Line 162
const rule = new events.Rule(this, 'ScheduledWorkflowRule', {
  ruleName: config.ruleName,
  description: config.description,
  schedule: events.Schedule.expression(config.scheduleExpression), // 'rate(5 minutes)'
});
```

### Step 2: Step Function Receives and Processes

The Step Function state machine receives the input and immediately calls the Lambda function.

**📍 Code Reference:**
```typescript
// apps/infrastructure/lib/infrastructure-stack.ts - Line 114
const startWorkflow = new sfnTasks.LambdaInvoke(this, 'StartWorkflow', {
  lambdaFunction: workflowLambda,
  payloadResponseOnly: true,
  retryOnServiceExceptions: true,
});
```

### Step 3: Lambda Function Executes the Workflow

The Lambda function `workflowHandler` processes the input:

**📍 Code Reference:**
```typescript
// packages/lambda-handlers/src/index.ts - Line 45
export const workflowHandler: Handler<WorkflowInput, WorkflowOutput> = async (
  event,
  context
) => {
  try {
    console.log('Starting workflow execution', {
      executionId: event.executionId,
      requestId: context.awsRequestId,
    });

    // Step 3a: Validate Input
    const validatedInput = validateInput(event);
    
    // Step 3b: Execute Workflow Logic
    const result = await executeWorkflow(validatedInput);
    
    return result;
  } catch (error) {
    // Step 3c: Handle Errors
    return {
      success: false,
      executionId: event.executionId,
      timestamp: new Date().toISOString(),
      error: errorMessage,
    };
  }
};
```

### Step 4: Input Validation

The function validates the incoming data to ensure it has required fields:

**📍 Code Reference:**
```typescript
// packages/lambda-handlers/src/index.ts - Line 15
const validateInput = (input: unknown): WorkflowInput => {
  if (!input || typeof input !== 'object') {
    throw new Error('Invalid input: must be an object');
  }

  const inputObj = input as Record<string, unknown>;
  
  if (!inputObj.executionId || typeof inputObj.executionId !== 'string') {
    throw new Error('Invalid input: executionId is required and must be a string');
  }

  if (!inputObj.timestamp || typeof inputObj.timestamp !== 'string') {
    throw new Error('Invalid input: timestamp is required and must be a string');
  }

  return {
    executionId: inputObj.executionId,
    timestamp: inputObj.timestamp,
    data: inputObj.data as Record<string, unknown> | undefined,
  };
};
```

### Step 5: Workflow Execution

The actual business logic executes here (currently a simple simulation):

**📍 Code Reference:**
```typescript
// packages/lambda-handlers/src/index.ts - Line 35
const executeWorkflow = async (input: WorkflowInput): Promise<WorkflowOutput> => {
  console.log('Executing data migration workflow', { 
    executionId: input.executionId,
    triggerSource: input.data?.triggerSource 
  });

  // Simulate workflow processing
  await new Promise(resolve => setTimeout(resolve, 100));

  // Return successful result
  return {
    success: true,
    executionId: input.executionId,
    timestamp: new Date().toISOString(),
    result: {
      processed: true,
      workflowType: 'DataMigration',
      executedAt: new Date().toISOString(),
      inputData: input.data,
    },
  };
};
```

### Step 6: Step Function Evaluates Result

The Step Function checks if the Lambda execution was successful:

**📍 Code Reference:**
```typescript
// apps/infrastructure/lib/infrastructure-stack.ts - Line 132
const definition = startWorkflow
  .addCatch(errorHandler, {
    errors: ['States.ALL'],
    resultPath: '$.error',
  })
  .next(
    new stepfunctions.Choice(this, 'CheckWorkflowResult')
      .when(
        stepfunctions.Condition.booleanEquals('$.success', true),
        successState  // ✅ Goes here if success: true
      )
      .otherwise(errorHandler)  // ❌ Goes here if success: false
  );
```

### Step 7: Final Result

Based on the Lambda response, the Step Function either:
- ✅ **Succeeds**: Ends in `WorkflowSucceeded` state
- ❌ **Fails**: Ends in `WorkflowFailed` state

**📍 Code Reference:**
```typescript
// apps/infrastructure/lib/infrastructure-stack.ts - Line 123
const successState = new stepfunctions.Succeed(this, 'WorkflowSucceeded', {
  comment: 'Workflow completed successfully',
});

const errorHandler = new stepfunctions.Fail(this, 'WorkflowFailed', {
  cause: 'Workflow execution failed',
  error: 'WorkflowError',
});
```

## 🔄 Complete Execution Flow

```
1. ⏰ EventBridge Timer (every 5 min)
   ↓
2. 📋 Step Function receives input
   ↓
3. 🔧 Lambda function starts execution
   ↓
4. ✅ Input validation passes
   ↓
5. ⚙️ Workflow logic executes (100ms simulation)
   ↓
6. 📊 Lambda returns success result
   ↓
7. ✅ Step Function evaluates success=true
   ↓
8. 🎉 WorkflowSucceeded state reached
```

## 📁 Project Structure

```
turbo-data-migration/
├── apps/
│   └── infrastructure/          # AWS CDK Infrastructure
├── packages/
│   ├── lambda-handlers/         # Lambda function code
│   ├── types/                   # TypeScript interfaces
│   ├── step-function-core/      # Business logic (unused in current simplified version)
│   └── typescript-config/       # Shared TS config
└── turbo.json                   # Turbo build configuration
```

## 🚀 Getting Started

### Prerequisites
- Node.js >= 18
- AWS CLI configured
- AWS CDK CLI: `npm install -g aws-cdk`

### Quick Setup

```bash
# 1. Install dependencies
npm install

# 2. Build all packages
npm run build

# 3. Bootstrap CDK (first time only)
cd apps/infrastructure && npx cdk bootstrap

# 4. Deploy to AWS
npx cdk deploy
```

## 🔍 Monitoring & Logs

### CloudWatch Log Groups
The deployment creates dedicated log groups:

**📍 Code Reference:**
```typescript
// apps/infrastructure/lib/infrastructure-stack.ts - Line 52
const lambdaLogGroup = new logs.LogGroup(this, 'WorkflowLambdaLogGroup', {
  logGroupName: '/aws/lambda/WorkflowLambda',
  retention: logs.RetentionDays.ONE_WEEK,
});

const stateMachineLogGroup = new logs.LogGroup(this, 'StateMachineLogGroup', {
  logGroupName: `/aws/stepfunctions/${config.name}`,
  retention: logs.RetentionDays.ONE_WEEK,
});
```

### Viewing Logs
1. **Lambda Logs**: `/aws/lambda/WorkflowLambda`
2. **Step Function Logs**: `/aws/stepfunctions/DataMigrationWorkflow`

## 🔧 Configuration

### Change Execution Frequency
**📍 Code Reference:**
```typescript
// apps/infrastructure/lib/infrastructure-stack.ts - Line 24
const eventBridgeConfig: EventBridgeConfig = {
  ruleName: 'DataMigrationSchedule',
  scheduleExpression: 'rate(5 minutes)', // Change this: rate(1 hour), cron(0 9 * * ? *)
  description: 'Triggers data migration workflow every 5 minutes',
};
```

### Modify Workflow Logic
**📍 Code Reference:**
```typescript
// packages/lambda-handlers/src/index.ts - Line 35
const executeWorkflow = async (input: WorkflowInput): Promise<WorkflowOutput> => {
  // Add your custom business logic here
  console.log('Executing data migration workflow', { 
    executionId: input.executionId,
    triggerSource: input.data?.triggerSource 
  });

  // Your code here...
  
  return {
    success: true,
    executionId: input.executionId,
    timestamp: new Date().toISOString(),
    result: {
      // Your result data here...
    },
  };
};
```

## 🎯 Key Benefits

- **Simple**: Self-contained Lambda function with no external dependencies
- **Reliable**: Built-in retry logic and error handling
- **Observable**: CloudWatch logging for monitoring
- **Cost-effective**: Pay only for execution time
- **Maintainable**: Clean TypeScript code with strong typing

## 🔄 Development Workflow

```bash
# Make changes to Lambda code
vim packages/lambda-handlers/src/index.ts

# Build the changes
npm run build

# Deploy updates
cd apps/infrastructure && npx cdk deploy

# Monitor execution
aws logs tail /aws/lambda/WorkflowLambda --follow
```

## 🧹 Cleanup

```bash
# Destroy all AWS resources
cd apps/infrastructure && npx cdk destroy
```

This removes all created resources including Lambda functions, Step Functions, EventBridge rules, and CloudWatch log groups.
