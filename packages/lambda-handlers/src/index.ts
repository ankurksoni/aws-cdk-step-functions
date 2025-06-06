import { Handler } from 'aws-lambda';

// Types defined locally to avoid dependency issues
interface WorkflowInput {
  executionId: string;
  timestamp: string;
  data?: Record<string, unknown>;
}

interface WorkflowOutput {
  success: boolean;
  executionId: string;
  timestamp: string;
  error?: string;
  result?: Record<string, unknown>;
}

// Input validation with strong typing
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

// Simple workflow execution logic
const executeWorkflow = async (input: WorkflowInput): Promise<WorkflowOutput> => {
  console.log('Executing data migration workflow', { 
    executionId: input.executionId,
    triggerSource: input.data?.triggerSource 
  });

  // Simulate workflow processing
  await new Promise(resolve => setTimeout(resolve, 100));

  // Simple workflow result
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

// Main workflow handler
export const workflowHandler: Handler<WorkflowInput, WorkflowOutput> = async (
  event,
  context
) => {
  try {
    console.log('Starting workflow execution', {
      executionId: event.executionId,
      requestId: context.awsRequestId,
    });

    // Validate input
    const validatedInput = validateInput(event);

    // Execute workflow
    const result = await executeWorkflow(validatedInput);

    console.log('Workflow execution completed', {
      executionId: event.executionId,
      success: result.success,
      requestId: context.awsRequestId,
    });

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    console.error('Workflow execution failed', {
      executionId: event.executionId,
      error: errorMessage,
      requestId: context.awsRequestId,
    });

    return {
      success: false,
      executionId: event.executionId,
      timestamp: new Date().toISOString(),
      error: errorMessage,
    };
  }
};

// Trigger handler for EventBridge
export const triggerHandler: Handler = async (event, context) => {
  try {
    console.log('EventBridge trigger received', {
      event,
      requestId: context.awsRequestId,
    });

    // Generate execution ID and create workflow input
    const workflowInput: WorkflowInput = {
      executionId: context.awsRequestId,
      timestamp: new Date().toISOString(),
      data: {
        triggerSource: 'EventBridge',
        scheduledTime: event.time,
      },
    };

    return workflowInput;
  } catch (error) {
    console.error('Trigger handler failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      requestId: context.awsRequestId,
    });
    
    throw error;
  }
}; 