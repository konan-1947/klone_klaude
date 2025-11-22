# Execution Manager Interface

## Overview

Execution Manager chịu trách nhiệm orchestrate việc thực thi plan, execute từng step tuần tự, handle errors và retries, trigger callbacks, và track progress.

---

## Interface Definition

```typescript
interface IExecutionManager {
  /**
   * Execute toàn bộ plan
   * @param plan - Plan to execute
   * @returns ExecutionResult
   */
  executePlan(plan: Plan): Promise<ExecutionResult>;

  /**
   * Execute một step cụ thể
   * @param step - Step to execute
   * @param context - Execution context
   * @returns StepResult
   */
  executeStep(
    step: Step,
    context: ExecutionContext
  ): Promise<StepResult>;

  /**
   * Pause execution
   */
  pause(): void;

  /**
   * Resume execution
   */
  resume(): void;

  /**
   * Cancel execution
   */
  cancel(): void;

  /**
   * Retry a failed step
   */
  retryStep(stepId: string): Promise<StepResult>;

  /**
   * Get current execution state
   */
  getExecutionState(): ExecutionState;

  /**
   * Register event callbacks
   */
  on(event: ExecutionEvent, callback: EventCallback): void;
}
```

---

## Type Definitions

### ExecutionResult

```typescript
interface ExecutionResult {
  // Status
  success: boolean;
  status: ExecutionStatus;
  
  // Results
  finalOutput: any;
  stepResults: StepResult[];
  
  // Plan reference
  planId: string;
  plan: Plan;
  
  // Metrics
  totalSteps: number;
  completedSteps: number;
  failedSteps: number;
  skippedSteps: number;
  
  // Timing
  startTime: Date;
  endTime: Date;
  totalDuration: number; // milliseconds
  
  // Errors
  error?: Error;
  failureReason?: string;
  
  // Updates
  planUpdates: PlanUpdate[];
}

enum ExecutionStatus {
  SUCCESS = 'success',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  PARTIAL = 'partial' // Some steps failed but execution continued
}
```

### StepResult

```typescript
interface StepResult {
  // Step reference
  stepId: string;
  stepName: string;
  
  // Status
  success: boolean;
  status: StepStatus;
  
  // Output
  output: any;
  error?: Error;
  
  // Execution details
  executionType: ActionType;
  retryCount: number;
  
  // Timing
  startTime: Date;
  endTime: Date;
  duration: number; // milliseconds
  
  // Metadata
  metadata?: {
    llmTokens?: number;
    llmCost?: number;
    toolExecutions?: ToolExecutionInfo[];
    [key: string]: any;
  };
}

interface ToolExecutionInfo {
  toolName: string;
  params: any;
  result: any;
  duration: number;
}
```

### ExecutionContext

```typescript
interface ExecutionContext {
  // Plan context
  planId: string;
  originalRequest: string;
  
  // Code context
  codeContext: CodeContext;
  
  // Accumulated data from previous steps
  stepOutputs: Map<string, any>; // stepId -> output
  discoveries: string[];
  errors: Error[];
  
  // Project info
  projectContext: ProjectContext;
  
  // Runtime state
  currentStep: Step | null;
  previousStep: Step | null;
  nextStep: Step | null;
  
  // Shared state
  sharedState: Map<string, any>;
}

interface ProjectContext {
  projectPath: string;
  language: string;
  framework?: string;
  dependencies: string[];
  testFramework?: string;
}
```

### ExecutionState

```typescript
interface ExecutionState {
  // Current state
  status: 'idle' | 'running' | 'paused' | 'completed' | 'failed';
  currentStepId: string | null;
  
  // Progress
  progress: number; // 0.0 - 1.0
  completedSteps: number;
  totalSteps: number;
  
  // Timing
  startTime?: Date;
  elapsedTime: number; // milliseconds
  estimatedTimeRemaining?: number;
  
  // Metrics
  totalLLMCalls: number;
  totalToolCalls: number;
  totalCost: number;
}
```

---

## Execution Flow

### Main Execution Loop

```typescript
async executePlan(plan: Plan): Promise<ExecutionResult> {
  // Initialize
  this.state = this.initializeState(plan);
  const context = this.buildInitialContext(plan);
  const stepResults: StepResult[] = [];
  
  // Validate plan
  const validation = this.planManager.validatePlan(plan);
  if (!validation.valid) {
    throw new Error(`Invalid plan: ${validation.errors[0].message}`);
  }
  
  // Trigger start event
  this.emit('executionStart', { plan });
  
  let currentStep: Step | null = plan.firstStep;
  
  try {
    while (currentStep !== null) {
      // Check if paused
      await this.checkPauseState();
      
      // Check if cancelled
      if (this.state.status === 'cancelled') {
        throw new Error('Execution cancelled by user');
      }
      
      // Update state
      this.state.currentStepId = currentStep.stepId;
      context.currentStep = currentStep;
      context.previousStep = currentStep.prev;
      context.nextStep = currentStep.next;
      
      // Trigger step start event
      this.emit('stepStart', { step: currentStep });
      
      try {
        // Execute step
        const stepResult = await this.executeStep(currentStep, context);
        
        stepResults.push(stepResult);
        
        // Update context with result
        context.stepOutputs.set(currentStep.stepId, stepResult.output);
        
        // Trigger step end event
        this.emit('stepEnd', { step: currentStep, result: stepResult });
        
        // Check if plan needs update
        const shouldUpdate = await this.shouldUpdatePlan(
          currentStep,
          stepResult,
          context
        );
        
        if (shouldUpdate) {
          const update = await this.updatePlanDynamically(
            plan,
            currentStep,
            stepResult,
            context
          );
          
          this.emit('planUpdate', { update });
          
          // Adjust current step if needed
          currentStep = this.findStep(plan, this.state.currentStepId);
        }
        
      } catch (error) {
        // Handle step failure
        const shouldContinue = await this.handleStepError(
          currentStep,
          error as Error,
          context
        );
        
        if (!shouldContinue) {
          throw error;
        }
        
        // Log error and continue
        context.errors.push(error as Error);
      }
      
      // Move to next step
      currentStep = currentStep.next;
      
      // Update progress
      this.updateProgress(plan, stepResults.length);
    }
    
    // Success
    this.emit('executionEnd', {
      success: true,
      stepResults
    });
    
    return {
      success: true,
      status: ExecutionStatus.SUCCESS,
      finalOutput: this.extractFinalOutput(stepResults),
      stepResults,
      planId: plan.planId,
      plan,
      totalSteps: plan.steps.length,
      completedSteps: stepResults.filter(r => r.success).length,
      failedSteps: stepResults.filter(r => !r.success).length,
      skippedSteps: 0,
      startTime: this.state.startTime!,
      endTime: new Date(),
      totalDuration: Date.now() - this.state.startTime!.getTime(),
      planUpdates: plan.updateHistory
    };
    
  } catch (error) {
    // Execution failed
    this.emit('executionEnd', {
      success: false,
      error,
      stepResults
    });
    
    return {
      success: false,
      status: ExecutionStatus.FAILED,
      finalOutput: null,
      stepResults,
      planId: plan.planId,
      plan,
      totalSteps: plan.steps.length,
      completedSteps: stepResults.filter(r => r.success).length,
      failedSteps: stepResults.filter(r => !r.success).length,
      skippedSteps: 0,
      startTime: this.state.startTime!,
      endTime: new Date(),
      totalDuration: Date.now() - this.state.startTime!.getTime(),
      error: error as Error,
      failureReason: (error as Error).message,
      planUpdates: plan.updateHistory
    };
  }
}
```

---

## Step Execution

### Execute Step by Action Type

```typescript
async executeStep(
  step: Step,
  context: ExecutionContext
): Promise<StepResult> {
  const startTime = new Date();
  step.status = StepStatus.RUNNING;
  step.startTime = startTime;
  
  try {
    let output: any;
    let metadata: any = {};
    
    switch (step.actionType) {
      case ActionType.LLM:
        output = await this.executeLLMStep(step, context);
        metadata.llmTokens = this.lastLLMTokens;
        break;
        
      case ActionType.TOOL:
        output = await this.executeToolStep(step, context);
        metadata.toolExecutions = this.lastToolExecutions;
        break;
        
      case ActionType.PTK:
        output = await this.executePTKStep(step, context);
        metadata.llmTokens = this.lastLLMTokens;
        metadata.toolExecutions = this.lastToolExecutions;
        break;
        
      default:
        throw new Error(`Unknown action type: ${step.actionType}`);
    }
    
    // Success
    const endTime = new Date();
    step.status = StepStatus.COMPLETED;
    step.endTime = endTime;
    step.output = output;
    
    return {
      stepId: step.stepId,
      stepName: step.stepName,
      success: true,
      status: StepStatus.COMPLETED,
      output,
      executionType: step.actionType,
      retryCount: step.retryCount,
      startTime,
      endTime,
      duration: endTime.getTime() - startTime.getTime(),
      metadata
    };
    
  } catch (error) {
    // Failure - handle retry
    const shouldRetry = await this.shouldRetryStep(step, error as Error);
    
    if (shouldRetry) {
      step.retryCount++;
      step.status = StepStatus.RETRYING;
      
      // Wait before retry
      await this.waitForRetry(step);
      
      // Retry
      return this.executeStep(step, context);
    }
    
    // Failed permanently
    const endTime = new Date();
    step.status = StepStatus.FAILED;
    step.endTime = endTime;
    step.error = error as Error;
    
    return {
      stepId: step.stepId,
      stepName: step.stepName,
      success: false,
      status: StepStatus.FAILED,
      output: null,
      error: error as Error,
      executionType: step.actionType,
      retryCount: step.retryCount,
      startTime,
      endTime,
      duration: endTime.getTime() - startTime.getTime()
    };
  }
}
```

### Execute LLM Step

```typescript
async executeLLMStep(step: Step, context: ExecutionContext): Promise<any> {
  if (!step.config.llm) {
    throw new Error('LLM config missing');
  }
  
  // Build prompt with context
  const prompt = this.interpolatePrompt(
    step.config.llm.prompt,
    context
  );
  
  // Call LLM Manager
  const response = await this.llmManager.call(prompt, {
    model: step.config.llm.model,
    temperature: step.config.llm.temperature,
    maxTokens: step.config.llm.maxTokens,
    systemPrompt: step.config.llm.systemPrompt
  });
  
  return response;
}
```

### Execute Tool Step

```typescript
async executeToolStep(step: Step, context: ExecutionContext): Promise<any> {
  if (!step.config.tool) {
    throw new Error('Tool config missing');
  }
  
  // Interpolate params with context
  const params = this.interpolateParams(
    step.config.tool.toolParams,
    context
  );
  
  // Call Tool Manager
  const result = await this.toolManager.execute(
    step.config.tool.toolName,
    params
  );
  
  // Validate if needed
  if (step.config.tool.validateOutput) {
    this.validateToolOutput(result, step.config.tool.toolName);
  }
  
  return result;
}
```

### Execute PTK Step

```typescript
async executePTKStep(step: Step, context: ExecutionContext): Promise<any> {
  if (!step.config.ptk) {
    throw new Error('PTK config missing');
  }
  
  // Build prompt
  const prompt = this.interpolatePrompt(
    step.config.ptk.prompt,
    context
  );
  
  // Get tool instances
  const tools = this.toolManager.getTools(step.config.ptk.tools);
  
  // Call PTK Manager
  const result = await this.ptkManager.execute(prompt, {
    tools,
    maxIterations: step.config.ptk.maxIterations || 5
  });
  
  return result;
}
```

---

## Error Handling

### Retry Strategy

```typescript
async shouldRetryStep(step: Step, error: Error): Promise<boolean> {
  // Check retry count
  if (step.retryCount >= step.maxRetries) {
    return false;
  }
  
  // Check error type
  if (this.isRetryableError(error)) {
    return true;
  }
  
  return false;
}

isRetryableError(error: Error): boolean {
  const retryableErrors = [
    'RATE_LIMIT',
    'TIMEOUT',
    'NETWORK_ERROR',
    'TEMPORARY_ERROR'
  ];
  
  return retryableErrors.some(code => 
    error.message.includes(code)
  );
}

async waitForRetry(step: Step): Promise<void> {
  // Exponential backoff
  const delay = step.retryDelay * Math.pow(2, step.retryCount);
  await new Promise(resolve => setTimeout(resolve, delay));
}
```

### Handle Step Error - Plan Manager Intervention

```typescript
async handleStepError(
  step: Step,
  error: Error,
  context: ExecutionContext,
  plan: Plan
): Promise<boolean> {
  // Trigger error event
  this.emit('stepError', { step, error });
  
  // Check if step is skippable (non-critical)
  if (step.metadata?.skippable) {
    console.warn(`Skipping failed step: ${step.stepName}`, error);
    step.status = StepStatus.SKIPPED;
    return true; // Continue execution
  }
  
  // CRITICAL FAILURE: Ask Plan Manager to intervene
  // Plan Manager sẽ analyze failure và redesign plan
  
  try {
    const redesign = await this.planManager.handleStepFailure({
      failedStep: step,
      error,
      context,
      currentPlan: plan,
      completedSteps: this.getCompletedSteps(plan),
      remainingSteps: this.getRemainingSteps(plan, step)
    });
    
    if (redesign.action === 'retry_with_changes') {
      // Plan Manager suggests retry với modifications
      console.log(`Plan Manager: Retry step with changes - ${redesign.reason}`);
      
      // Apply changes to step config
      this.applyStepModifications(step, redesign.modifications);
      
      // Reset retry count cho modified approach
      step.retryCount = 0;
      
      // Trigger event
      this.emit('stepModified', { step, redesign });
      
      return true; // Continue and retry
    }
    
    if (redesign.action === 'insert_recovery_steps') {
      // Plan Manager inserts recovery steps
      console.log(`Plan Manager: Inserting ${redesign.recoverySteps.length} recovery steps - ${redesign.reason}`);
      
      // Insert recovery steps BEFORE failed step
      for (const recoveryStep of redesign.recoverySteps) {
        this.planManager.insertStepBefore(plan, step.stepId, recoveryStep);
      }
      
      // Mark failed step for retry sau recovery
      step.status = StepStatus.PENDING;
      step.retryCount = 0;
      
      // Trigger event
      this.emit('planRedesigned', { 
        reason: redesign.reason,
        recoverySteps: redesign.recoverySteps 
      });
      
      // Jump back to first recovery step
      const firstRecovery = redesign.recoverySteps[0];
      this.state.currentStepId = firstRecovery.stepId;
      
      return true; // Continue with recovery
    }
    
    if (redesign.action === 'redesign_remaining_plan') {
      // Plan Manager redesigns toàn bộ remaining plan
      console.log(`Plan Manager: Redesigning remaining plan - ${redesign.reason}`);
      
      // Remove remaining steps
      this.planManager.removeStepsAfter(plan, step.stepId);
      
      // Add new steps from redesign
      for (const newStep of redesign.newSteps) {
        this.planManager.appendStep(plan, newStep);
      }
      
      // Trigger event
      this.emit('planRedesigned', { 
        reason: redesign.reason,
        newSteps: redesign.newSteps 
      });
      
      // Continue with new plan
      return true;
    }
    
    if (redesign.action === 'fail_gracefully') {
      // Plan Manager cho phép fail với explanation
      console.log(`Plan Manager: Cannot recover - ${redesign.reason}`);
      
      this.emit('executionFailed', {
        step,
        error,
        reason: redesign.reason,
        partialResults: this.getCompletedSteps(plan)
      });
      
      return false; // Stop execution
    }
    
    // Unknown action - default to fail
    return false;
    
  } catch (redesignError) {
    // Plan Manager itself failed - stop execution
    console.error('Plan Manager redesign failed:', redesignError);
    this.emit('redesignFailed', { step, error, redesignError });
    return false;
  }
}

/**
 * Apply modifications to step config (từ Plan Manager suggestions)
 */
private applyStepModifications(step: Step, modifications: StepModifications): void {
  if (modifications.prompt) {
    if (step.config.llm) {
      step.config.llm.prompt = modifications.prompt;
    } else if (step.config.ptk) {
      step.config.ptk.prompt = modifications.prompt;
    }
  }
  
  if (modifications.tools) {
    if (step.config.ptk) {
      step.config.ptk.tools = modifications.tools;
    }
  }
  
  if (modifications.parameters) {
    if (step.config.tool) {
      step.config.tool.toolParams = {
        ...step.config.tool.toolParams,
        ...modifications.parameters
      };
    }
  }
  
  // Add modification history
  step.metadata = step.metadata || {};
  step.metadata.modifications = step.metadata.modifications || [];
  step.metadata.modifications.push({
    timestamp: new Date(),
    changes: modifications
  });
}

/**
 * Helper methods
 */
private getCompletedSteps(plan: Plan): Step[] {
  return plan.steps.filter(s => s.status === StepStatus.COMPLETED);
}

private getRemainingSteps(plan: Plan, currentStep: Step): Step[] {
  const steps: Step[] = [];
  let step = currentStep.next;
  
  while (step) {
    steps.push(step);
    step = step.next;
  }
  
  return steps;
}
```

**Key Changes:**
1. **Plan Manager Intervention**: Khi step fail, gọi `planManager.handleStepFailure()`
2. **Multiple Recovery Strategies**:
   - `retry_with_changes`: Retry với modified config
   - `insert_recovery_steps`: Insert steps để recover
   - `redesign_remaining_plan`: Redesign toàn bộ
   - `fail_gracefully`: Accept failure với explanation
3. **No Silent Fallback**: Mọi decision đều từ Plan Manager
4. **Transparent**: Emit events cho mọi thay đổi

---

## Dynamic Plan Updates

```typescript
async shouldUpdatePlan(
  step: Step,
  result: StepResult,
  context: ExecutionContext
): Promise<boolean> {
  // Example: Tool found more files than expected
  if (step.actionType === ActionType.TOOL && 
      step.config.tool?.toolName === 'search_files') {
    const fileCount = result.output?.files?.length || 0;
    
    if (fileCount > 10) {
      return true; // Need extra analysis step
    }
  }
  
  // Example: Tests failed
  if (step.actionType === ActionType.TOOL && 
      step.config.tool?.toolName === 'run_tests') {
    if (!result.success || result.output?.failedTests?.length > 0) {
      return true; // Need fix step
    }
  }
  
  return false;
}

async updatePlanDynamically(
  plan: Plan,
  step: Step,
  result: StepResult,
  context: ExecutionContext
): Promise<PlanUpdate> {
  // Example: Insert analysis step
  if (result.output?.files?.length > 10) {
    const newStep: Step = {
      stepId: `${step.stepId}.extra`,
      stepName: 'Analyze Additional Files',
      stepDescription: 'Analyze the extra files found',
      actionType: ActionType.PTK,
      config: {
        ptk: {
          prompt: 'Analyze these additional files',
          tools: ['read_file', 'search_code']
        }
      },
      status: StepStatus.PENDING,
      retryCount: 0,
      maxRetries: 2,
      retryDelay: 1000,
      dependsOn: [step.stepId],
      requiredTools: [],
      next: null,
      prev: null
    };
    
    this.planManager.insertStepAfter(plan, step.stepId, newStep);
    
    return {
      timestamp: new Date(),
      type: 'insert',
      stepId: newStep.stepId,
      reason: `Found ${result.output.files.length} files, adding analysis step`
    };
  }
  
  throw new Error('No update needed');
}
```

---

## Event System

```typescript
enum ExecutionEvent {
  EXECUTION_START = 'executionStart',
  EXECUTION_END = 'executionEnd',
  STEP_START = 'stepStart',
  STEP_END = 'stepEnd',
  STEP_ERROR = 'stepError',
  PLAN_UPDATE = 'planUpdate',
  PROGRESS_UPDATE = 'progressUpdate'
}

type EventCallback = (data: any) => void;

class ExecutionManager {
  private eventHandlers: Map<ExecutionEvent, EventCallback[]> = new Map();
  
  on(event: ExecutionEvent, callback: EventCallback): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event)!.push(callback);
  }
  
  private emit(event: ExecutionEvent, data: any): void {
    const handlers = this.eventHandlers.get(event) || [];
    for (const handler of handlers) {
      try {
        handler(data);
      } catch (error) {
        console.error(`Error in event handler for ${event}:`, error);
      }
    }
  }
}
```

---

## Dependencies

```typescript
interface IExecutionManager {
  constructor(
    private planManager: IPlanManager,
    private ptkManager: IPTKManager,
    private llmManager: ILLMManager,
    private toolManager: IToolManager,
    private contextManager: IContextManager,
    private config: ExecutionManagerConfig
  );
}

interface ExecutionManagerConfig {
  maxRetries: number;
  retryDelay: number;
  enableDynamicUpdates: boolean;
  validateSteps: boolean;
  timeout: number;
}
```

---

## Usage Example

```typescript
const executionManager = new ExecutionManager(
  planManager,
  ptkManager,
  llmManager,
  toolManager,
  contextManager,
  config
);

// Register event handlers
executionManager.on('stepStart', ({ step }) => {
  console.log(`Starting: ${step.stepName}`);
  updateProgressBar(step.stepNumber);
});

executionManager.on('stepEnd', ({ step, result }) => {
  console.log(`Completed: ${step.stepName}`, result);
});

executionManager.on('planUpdate', ({ update }) => {
  console.log(`Plan updated: ${update.reason}`);
});

// Execute plan
const result = await executionManager.executePlan(plan);

if (result.success) {
  console.log('Execution completed successfully');
  showInlineDiff(result.finalOutput);
} else {
  console.error('Execution failed:', result.failureReason);
}
```
