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
// packages/lambda-handlers/src/index.ts - Line 62
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
// packages/lambda-handlers/src/index.ts - Line 37
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
aws-cdk-step-functions/
├── apps/
│   └── infrastructure/          # AWS CDK Infrastructure
├── packages/
│   ├── lambda-handlers/         # Self-contained Lambda function
│   ├── types/                   # Shared TypeScript interfaces
│   └── typescript-config/       # Shared TS configuration
└── turbo.json                   # Turbo build configuration
```

## 🚀 Getting Started

### Prerequisites
- Node.js >= 18
- AWS CLI configured
- AWS CDK CLI: `npm install -g aws-cdk`

### Quick Setup

```bash
# 1. Install dependencies and build all packages
npm run install:all

# 2. Bootstrap CDK (first time only)
npm run cdk:bootstrap

# 3. Deploy to AWS
npm run cdk:deploy
```

### Available NPM Scripts

```bash
# Development
npm run build              # Build all packages
npm run dev               # Start development mode
npm run lint              # Lint all packages
npm run format            # Format code with Prettier
npm run check-types       # Type check all packages
npm run clean             # Clean build artifacts

# AWS CDK Operations
npm run cdk:bootstrap     # Bootstrap CDK (first time setup)
npm run cdk:synth         # Synthesize CloudFormation template
npm run cdk:deploy        # Deploy infrastructure to AWS
npm run cdk:destroy       # Destroy all AWS resources

# Complete Setup
npm run install:all       # Install dependencies + build everything
```

## 🔍 Monitoring & Logs

### CloudWatch Log Groups
The deployment creates dedicated log groups with 1-week retention:

**📍 Code Reference:**
```typescript
// apps/infrastructure/lib/infrastructure-stack.ts - Line 57
const lambdaLogGroup = new logs.LogGroup(this, 'WorkflowLambdaLogGroup', {
  logGroupName: '/aws/lambda/WorkflowLambda',
  retention: logs.RetentionDays.ONE_WEEK,
  removalPolicy: cdk.RemovalPolicy.DESTROY,
});

const stateMachineLogGroup = new logs.LogGroup(this, 'StateMachineLogGroup', {
  logGroupName: `/aws/stepfunctions/${config.name}`,
  retention: logs.RetentionDays.ONE_WEEK,
  removalPolicy: cdk.RemovalPolicy.DESTROY,
});
```

### Viewing Logs
1. **Lambda Logs**: `/aws/lambda/WorkflowLambda`
2. **Step Function Logs**: `/aws/stepfunctions/DataMigrationWorkflow`

### Lambda Logging Permissions
The Lambda function has explicit CloudWatch Logs permissions:

**📍 Code Reference:**
```typescript
// apps/infrastructure/lib/infrastructure-stack.ts - Line 75
workflowLambda.addToRolePolicy(
  new iam.PolicyStatement({
    effect: iam.Effect.ALLOW,
    actions: [
      'logs:CreateLogGroup',
      'logs:CreateLogStream',
      'logs:PutLogEvents',
      'logs:DescribeLogGroups',
      'logs:DescribeLogStreams',
    ],
    resources: [
      lambdaLogGroup.logGroupArn,
      `${lambdaLogGroup.logGroupArn}:*`,
    ],
  })
);
```

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
// packages/lambda-handlers/src/index.ts - Line 37
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

### Types and Interfaces
Shared types are defined in the types package:

**📍 Code Reference:**
```typescript
// packages/types/src/index.ts
export interface WorkflowInput {
  readonly executionId: string;
  readonly timestamp: string;
  readonly data?: Record<string, unknown>;
}

export interface WorkflowOutput {
  readonly success: boolean;
  readonly executionId: string;
  readonly timestamp: string;
  readonly result?: Record<string, unknown>;
  readonly error?: string;
}
```

## 🎯 Key Benefits

- **Simple**: Self-contained Lambda function with no external dependencies
- **Reliable**: Built-in retry logic and error handling in Step Functions
- **Observable**: CloudWatch logging for monitoring and debugging
- **Cost-effective**: Pay only for execution time, 1-week log retention
- **Maintainable**: Clean TypeScript code with strong typing
- **Scalable**: EventBridge + Step Functions handle concurrent executions

## 🔄 Development Workflow

The project uses npm scripts for a streamlined development experience:

```bash
# Make changes to Lambda code
vim packages/lambda-handlers/src/index.ts

# Build and deploy in one go
npm run build && npm run cdk:deploy

# Monitor execution in real-time
aws logs tail /aws/lambda/WorkflowLambda --follow
```

### Step-by-Step Development Process

```bash
# 1. Initial setup (first time only)
npm run install:all        # Install deps + build all packages
npm run cdk:bootstrap      # Setup CDK in your AWS account

# 2. Deploy infrastructure
npm run cdk:deploy         # Deploy to AWS

# 3. Make code changes
vim packages/lambda-handlers/src/index.ts
vim packages/types/src/index.ts

# 4. Test changes locally
npm run build              # Build all packages
npm run check-types        # Verify TypeScript types
npm run lint              # Check code quality

# 5. Deploy updates
npm run cdk:deploy         # Deploy changes to AWS

# 6. View deployment template (optional)
npm run cdk:synth         # Generate CloudFormation template
```

### Quick Commands Reference

| Task | Command | Description |
|------|---------|-------------|
| **First Setup** | `npm run install:all` | Install dependencies + build |
| **CDK Bootstrap** | `npm run cdk:bootstrap` | One-time CDK account setup |
| **Deploy** | `npm run cdk:deploy` | Deploy infrastructure |
| **Development** | `npm run build` | Build all packages |
| **Type Check** | `npm run check-types` | Verify TypeScript |
| **Clean Up** | `npm run cdk:destroy` | Remove all AWS resources |

## 🧹 Cleanup

```bash
# Destroy all AWS resources
npm run cdk:destroy
```

This removes all created resources including:
- Lambda functions
- Step Functions state machine
- EventBridge rules
- CloudWatch log groups
- IAM roles and policies

## 🏗️ Infrastructure Components

### AWS Resources Created:
1. **Lambda Function**: Executes the workflow logic
2. **Step Function**: Orchestrates the workflow with error handling
3. **EventBridge Rule**: Triggers execution every 5 minutes
4. **CloudWatch Log Groups**: Centralized logging for Lambda and Step Functions
5. **IAM Roles**: Least-privilege permissions for each service

## 🔗 Monorepo Package Linking - How "@repo/types": "*" Works

Understanding how internal packages are linked is crucial for monorepo development. Here's exactly how `"@repo/types": "*" workspace dependencies are linked in the turbo monorepo, including npm workspaces, symlinks, and the resolution process.

### Step 1: Workspace Configuration

The root `package.json` tells npm where to find workspace packages:

**📍 Code Reference:**
```json
// package.json (root)
{
  "workspaces": [
    "apps/*",        // npm scans: apps/infrastructure/
    "packages/*"     // npm scans: packages/types/, packages/lambda-handlers/, etc.
  ]
}
```

### Step 2: Package Discovery

When you run `npm install`, npm discovers all workspace packages:

```bash
# npm internally builds this registry:
Found: packages/types/package.json          → @repo/types
Found: packages/lambda-handlers/package.json → @repo/lambda-handlers  
Found: packages/typescript-config/package.json → @repo/typescript-config
Found: apps/infrastructure/package.json     → infrastructure
```

**📍 Code Reference:**
```json
// packages/types/package.json
{
  "name": "@repo/types",           // ← This name gets registered
  "main": "./dist/index.js",       // ← Entry point for Node.js
  "types": "./dist/index.d.ts"     // ← Entry point for TypeScript
}
```

### Step 3: Dependency Resolution

When npm encounters a workspace dependency, it creates symlinks instead of downloading:

**📍 Code Reference:**
```json
// apps/infrastructure/package.json
{
  "dependencies": {
    "@repo/types": "*"             // ← npm matches this with workspace registry
  }
}
```

**NPM Resolution Logic:**
```typescript
// Simplified npm resolution process
function resolvePackage(packageName: string, versionSpec: string) {
  // 1. Check workspace registry first
  if (workspaceRegistry.has(packageName)) {
    const localPath = workspaceRegistry.get(packageName);
    return createSymlink(localPath);  // ← Creates symlink instead of download
  }
  
  // 2. Only if not found locally, fetch from npm registry
  return downloadFromRegistry(packageName, versionSpec);
}
```

### Step 4: Symlink Creation

npm creates symlinks in `node_modules/@repo/`:

```bash
# Actual file system structure after npm install:
node_modules/
└── @repo/
    ├── types -> ../../packages/types                    # ← Symlink
    ├── lambda-handlers -> ../../packages/lambda-handlers # ← Symlink  
    └── typescript-config -> ../../packages/typescript-config # ← Symlink
```

**You can verify this:**
```bash
$ ls -la node_modules/@repo/
total 16
drwxrwxr-x   2 ankur ankur  4096 Jun  6 18:18 .
drwxrwxr-x 226 ankur ankur 12288 Jun  6 17:35 ..
lrwxrwxrwx   1 ankur ankur    30 Jun  6 17:35 lambda-handlers -> ../../packages/lambda-handlers
lrwxrwxrwx   1 ankur ankur    20 Jun  6 17:35 types -> ../../packages/types
lrwxrwxrwx   1 ankur ankur    32 Jun  6 17:35 typescript-config -> ../../packages/typescript-config

$ readlink node_modules/@repo/types
../../packages/types
```

### Step 5: Import Resolution

When TypeScript/Node.js resolves imports, it follows the symlinks:

**📍 Code Reference:**
```typescript
// apps/infrastructure/lib/infrastructure-stack.ts
import { StepFunctionConfig, EventBridgeConfig } from '@repo/types';
```

**Resolution Chain:**
```
1. TypeScript sees: import from '@repo/types'
2. Looks in: node_modules/@repo/types/
3. Follows symlink: ../../packages/types/
4. Reads: packages/types/package.json → "types": "./dist/index.d.ts"
5. Loads types: packages/types/dist/index.d.ts
6. Runtime loads: packages/types/dist/index.js
```

### Step 6: The "*" Version Magic

The `"*"` version specifier has special meaning in workspaces:

```json
{
  "@repo/types": "*"    // ← Means "any version, prefer workspace"
}
```

**Why `"*"` works:**
- **Workspace Priority**: npm always prefers local workspace packages over registry packages
- **Version Flexibility**: `"*"` accepts any version, including local `0.0.0`
- **Development Mode**: Perfect for packages under active development

### Step 7: Build Order Dependencies

Turbo uses the workspace dependencies to determine build order:

**📍 Code Reference:**
```bash
# When you run: npm run build
# Turbo builds in dependency order:

1. @repo/types (no dependencies)
2. @repo/lambda-handlers (depends on @repo/types)  
3. infrastructure (depends on @repo/types, @repo/lambda-handlers)
```

**Verification Command:**
```bash
$ npm list --depth=0
turbo-data-migration@ /home/ankur/Software/aws-cdk-step-functions
├─┬ @repo/types@0.0.0 -> ./packages/types           # ← Local symlink
├─┬ infrastructure@0.1.0 -> ./apps/infrastructure   # ← Local symlink
│   ├── @repo/types@0.0.0 deduped -> ./packages/types # ← Shared dependency
└── aws-cdk-lib@2.198.0                             # ← External package
```

### 🎯 Key Benefits

1. **Instant Updates**: Changes in `packages/types/src/` are immediately available to `apps/infrastructure/`
2. **No Publishing**: No need to publish internal packages to npm registry
3. **Type Safety**: Full TypeScript support across packages
4. **Hot Reloading**: Development servers pick up changes instantly
5. **Dependency Management**: Turbo handles build order automatically

### 🔧 Monorepo Development Workflow

```bash
# 1. Edit types
vim packages/types/src/index.ts

# 2. Build types package
npm run build

# 3. Infrastructure immediately sees the changes (via symlink)
npm run cdk:deploy  # ← Uses updated types

# 4. Or check specific build status
npm run check-types  # ← Verify TypeScript across all packages
```

### 🚨 Common Issues & Solutions

**Problem**: `Cannot find module '@repo/types'`
```bash
# Solution: Ensure workspace packages are built
npm run build
```

**Problem**: TypeScript can't find type definitions
```bash
# Solution: Check if dist/ folder exists
ls packages/types/dist/
# If missing, build the types package:
npm run build
```

**Problem**: Changes not reflected
```bash
# Solution: Rebuild everything with correct order
npm run build
```

This symlink-based approach is what makes modern monorepos so powerful for development! 🚀

## 🎯 Key Benefits

- **Simple**: Self-contained Lambda function with no external dependencies
- **Reliable**: Built-in retry logic and error handling in Step Functions
- **Observable**: CloudWatch logging for monitoring and debugging
- **Cost-effective**: Pay only for execution time, 1-week log retention
- **Maintainable**: Clean TypeScript code with strong typing
- **Scalable**: EventBridge + Step Functions handle concurrent executions