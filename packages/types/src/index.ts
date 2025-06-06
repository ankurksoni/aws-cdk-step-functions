// Core types for Step Function workflow
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

export interface StepFunctionConfig {
  readonly name: string;
  readonly timeout: number;
  readonly retryAttempts: number;
}

export interface EventBridgeConfig {
  readonly ruleName: string;
  readonly scheduleExpression: string;
  readonly description: string;
}

// Event types
export interface ScheduledEvent {
  readonly source: string;
  readonly time: string;
  readonly detail: Record<string, unknown>;
}

// Step Function state types
export interface ExecutionContext {
  readonly executionId: string;
  readonly stateMachineName: string;
  readonly input: WorkflowInput;
}

export interface StepResult {
  readonly stepName: string;
  readonly success: boolean;
  readonly output?: Record<string, unknown>;
  readonly error?: string;
} 