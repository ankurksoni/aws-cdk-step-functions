import { Handler } from 'aws-lambda';
import { Logger } from '@aws-lambda-powertools/logger';
import { Tracer } from '@aws-lambda-powertools/tracer';
import { WorkflowInput, WorkflowOutput } from '@repo/types';
import { WorkflowFactory } from '@repo/step-function-core';

const logger = new Logger({ serviceName: 'step-function-workflow' });
const tracer = new Tracer({ serviceName: 'step-function-workflow' });

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

// Main workflow handler
export const workflowHandler: Handler<WorkflowInput, WorkflowOutput> = async (
  event,
  context
) => {
  const segment = tracer.getSegment();
  const subsegment = segment?.addNewSubsegment('workflow-execution');

  try {
    logger.info('Starting workflow execution', {
      executionId: event.executionId,
      requestId: context.awsRequestId,
    });

    // Validate input
    const validatedInput = validateInput(event);

    // Create and execute workflow
    const workflow = WorkflowFactory.createDataMigrationWorkflow();
    const result = await workflow.execute(validatedInput);

    logger.info('Workflow execution completed', {
      executionId: event.executionId,
      success: result.success,
      requestId: context.awsRequestId,
    });

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    logger.error('Workflow execution failed', {
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
  } finally {
    subsegment?.close();
  }
};

// Trigger handler for EventBridge
export const triggerHandler: Handler = async (event, context) => {
  try {
    logger.info('EventBridge trigger received', {
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
    logger.error('Trigger handler failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      requestId: context.awsRequestId,
    });
    
    throw error;
  }
}; 