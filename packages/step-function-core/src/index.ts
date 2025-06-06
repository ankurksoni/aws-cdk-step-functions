import {
  WorkflowInput,
  WorkflowOutput,
  StepResult,
  ExecutionContext,
} from '@repo/types';

// Interface Segregation Principle - focused interfaces
export interface WorkflowProcessor {
  execute(input: WorkflowInput): Promise<WorkflowOutput>;
}

export interface StepExecutor {
  execute(context: ExecutionContext): Promise<StepResult>;
}

export interface ErrorHandler {
  handle(error: Error, context: ExecutionContext): Promise<WorkflowOutput>;
}

// Single Responsibility Principle - each class has one reason to change
export class DataProcessingStep implements StepExecutor {
  async execute(context: ExecutionContext): Promise<StepResult> {
    try {
      // Simulate data processing logic
      const processedData = {
        processed: true,
        timestamp: new Date().toISOString(),
        inputData: context.input.data,
      };

      return {
        stepName: 'DataProcessing',
        success: true,
        output: processedData,
      };
    } catch (error) {
      return {
        stepName: 'DataProcessing',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

export class ValidationStep implements StepExecutor {
  async execute(context: ExecutionContext): Promise<StepResult> {
    try {
      // Validate input data
      if (!context.input.executionId) {
        throw new Error('Missing execution ID');
      }

      return {
        stepName: 'Validation',
        success: true,
        output: { validated: true },
      };
    } catch (error) {
      return {
        stepName: 'Validation',
        success: false,
        error: error instanceof Error ? error.message : 'Validation failed',
      };
    }
  }
}

// Dependency Inversion Principle - depend on abstractions
export class WorkflowOrchestrator implements WorkflowProcessor {
  private readonly steps: StepExecutor[];
  private readonly errorHandler: ErrorHandler;

  constructor(steps: StepExecutor[], errorHandler: ErrorHandler) {
    this.steps = steps;
    this.errorHandler = errorHandler;
  }

  async execute(input: WorkflowInput): Promise<WorkflowOutput> {
    const context: ExecutionContext = {
      executionId: input.executionId,
      stateMachineName: 'DataMigrationWorkflow',
      input,
    };

    try {
      const results: Record<string, unknown> = {};

      for (const step of this.steps) {
        const stepResult = await step.execute(context);
        
        if (!stepResult.success) {
          throw new Error(`Step ${stepResult.stepName} failed: ${stepResult.error}`);
        }

        if (stepResult.output) {
          results[stepResult.stepName] = stepResult.output;
        }
      }

      return {
        success: true,
        executionId: input.executionId,
        timestamp: new Date().toISOString(),
        result: results,
      };
    } catch (error) {
      return await this.errorHandler.handle(
        error instanceof Error ? error : new Error('Unknown error'),
        context
      );
    }
  }
}

export class DefaultErrorHandler implements ErrorHandler {
  async handle(error: Error, context: ExecutionContext): Promise<WorkflowOutput> {
    console.error('Workflow execution failed:', {
      executionId: context.executionId,
      error: error.message,
      timestamp: new Date().toISOString(),
    });

    return {
      success: false,
      executionId: context.executionId,
      timestamp: new Date().toISOString(),
      error: error.message,
    };
  }
}

// Factory pattern for workflow creation
export class WorkflowFactory {
  static createDataMigrationWorkflow(): WorkflowProcessor {
    const steps = [
      new ValidationStep(),
      new DataProcessingStep(),
    ];
    
    const errorHandler = new DefaultErrorHandler();
    
    return new WorkflowOrchestrator(steps, errorHandler);
  }
} 