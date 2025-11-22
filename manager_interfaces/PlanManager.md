# Plan Manager Interface

## Overview

Plan Manager chịu trách nhiệm tạo execution plan cho complex tasks, validate plan, và thực hiện dynamic updates (insert, append, remove steps) trong quá trình thực thi.

---

## Interface Definition

```typescript
interface IPlanManager {
  /**
   * Tạo execution plan từ user request
   * @param request - User request
   * @param complexity - Complexity assessment
   * @param context - Code context
   * @returns Plan
   */
  generatePlan(
    request: string,
    complexity: ComplexityAssessment,
    context: CodeContext
  ): Promise<Plan>;

  /**
   * Validate plan structure và logic
   */
  validatePlan(plan: Plan): ValidationResult;

  /**
   * Handle step failure - redesign plan if needed
   * Called by Execution Manager khi step fails
   * Decision maker cho recovery strategy
   */
  handleStepFailure(context: StepFailureContext): Promise<FailureRedesign>;

  /**
   * Insert step sau một step cụ thể
   */
  insertStepAfter(
    plan: Plan,
    afterStepId: string,
    newStep: Step
  ): Plan;
  
  /**
   * Insert step TRƯỚC một step cụ thể
   */
  insertStepBefore(
    plan: Plan,
    beforeStepId: string,
    newStep: Step
  ): Plan;

  /**
   * Append step vào cuối plan
   */
  appendStep(plan: Plan, step: Step): Plan;

  /**
   * Remove step khỏi plan
   */
  removeStep(plan: Plan, stepId: string): Plan;
  
  /**
   * Remove tất cả steps SAU một step cụ thể
   */
  removeStepsAfter(plan: Plan, stepId: string): Plan;

  /**
   * Update step trong plan
   */
  updateStep(plan: Plan, stepId: string, updates: Partial<Step>): Plan;

  /**
   * Clone plan (for branching scenarios)
   */
  clonePlan(plan: Plan): Plan;
}
```

---

## Type Definitions

### Plan

```typescript
interface Plan {
  // Identity
  planId: string;
  createdAt: Date;
  updatedAt: Date;
  
  // Content
  steps: Step[];
  firstStep: Step;
  currentStep: Step | null;
  
  // Metadata
  status: PlanStatus;
  title: string;
  description: string;
  
  // Estimates
  estimatedTime: string; // e.g., "45-60 seconds"
  estimatedCost: string; // e.g., "$0.05-0.10"
  estimatedSteps: number;
  
  // Context
  originalRequest: string;
  complexity: ComplexityAssessment;
  
  // Execution tracking
  completedSteps: string[]; // stepIds
  failedSteps: string[];
  skippedSteps: string[];
  
  // Dynamic updates
  updateHistory: PlanUpdate[];
}

enum PlanStatus {
  IDLE = 'idle',
  RUNNING = 'running',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

interface PlanUpdate {
  timestamp: Date;
  type: 'insert' | 'append' | 'remove' | 'update';
  stepId: string;
  reason: string;
  metadata?: any;
}
```

### Step

```typescript
interface Step {
  // Identity
  stepId: string;
  stepNumber: number; // Display order
  stepName: string;
  stepDescription: string;
  
  // Type
  actionType: ActionType;
  
  // Configuration
  config: StepConfig;
  
  // Execution
  status: StepStatus;
  input: any;
  output: any;
  error?: Error;
  
  // Timing
  startTime?: Date;
  endTime?: Date;
  duration?: number; // milliseconds
  
  // Retry
  retryCount: number;
  maxRetries: number;
  retryDelay: number; // milliseconds
  
  // Dependencies
  dependsOn: string[]; // stepIds
  requiredTools: string[];
  
  // Links (Linked list structure)
  next: Step | null;
  prev: Step | null;
  
  // Metadata
  metadata?: {
    estimatedTime?: number;
    priority?: number;
    skippable?: boolean;
    [key: string]: any;
  };
}

enum ActionType {
  LLM = 'llm',
  TOOL = 'tool',
  PTK = 'ptk' // PTK-enabled LLM call with tools
}

enum StepStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  SKIPPED = 'skipped',
  RETRYING = 'retrying'
}
```

### StepConfig

```typescript
interface StepConfig {
  // LLM config
  llm?: {
    prompt: string;
    model?: string;
    temperature?: number;
    maxTokens?: number;
    systemPrompt?: string;
  };
  
  // Tool config
  tool?: {
    toolName: string;
    toolParams: Record<string, any>;
    validateOutput?: boolean;
  };
  
  // PTK config
  ptk?: {
    prompt: string;
    tools: string[]; // Tool names available
    maxIterations?: number;
  };
  
  // Conditions
  skipCondition?: string; // Expression to evaluate
  fallbackStep?: string; // stepId to jump to on failure
}
```

### ValidationResult

```typescript
interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

interface ValidationError {
  code: string;
  message: string;
  stepId?: string;
  field?: string;
}

interface ValidationWarning {
  code: string;
  message: string;
  stepId?: string;
}
```

---

## Plan Generation Strategies

### 1. Template-Based (Fast)

```typescript
/**
 * Use predefined templates for common tasks
 * Fast, no LLM call needed
 */
async generatePlan(
  request: string,
  complexity: ComplexityAssessment,
  context: CodeContext
): Promise<Plan> {
  // Detect task type
  const taskType = this.detectTaskType(request);
  
  // Get template
  const template = this.templates.get(taskType);
  
  if (template) {
    // Fill template with context
    return this.fillTemplate(template, request, context);
  }
  
  // Fallback to LLM generation
  return this.llmGeneratePlan(request, complexity, context);
}
```

### 2. LLM-Generated (Flexible)

```typescript
/**
 * Let LLM generate custom plan
 * More flexible but slower and costly
 */
async llmGeneratePlan(
  request: string,
  complexity: ComplexityAssessment,
  context: CodeContext
): Promise<Plan> {
  const prompt = this.buildPlanningPrompt(request, context);
  
  const response = await this.llmManager.call(prompt, {
    model: 'gemini-pro',
    temperature: 0.2 // Low creativity for planning
  });
  
  const planData = this.parsePlanResponse(response);
  
  return this.buildPlanFromData(planData);
}
```

---

## Plan Templates

### Template: Refactoring

```typescript
const REFACTORING_TEMPLATE: PlanTemplate = {
  name: 'refactoring',
  description: 'Multi-file code refactoring',
  steps: [
    {
      stepName: 'Analyze Current Code',
      actionType: ActionType.LLM,
      config: {
        llm: {
          prompt: 'Analyze the current code structure for: {request}'
        }
      }
    },
    {
      stepName: 'Find Related Files',
      actionType: ActionType.TOOL,
      config: {
        tool: {
          toolName: 'search_files',
          toolParams: { pattern: '{pattern}' }
        }
      }
    },
    {
      stepName: 'Generate Refactored Code',
      actionType: ActionType.PTK,
      config: {
        ptk: {
          prompt: 'Refactor the code based on analysis',
          tools: ['read_file', 'search_code']
        }
      }
    },
    {
      stepName: 'Run Tests',
      actionType: ActionType.TOOL,
      config: {
        tool: {
          toolName: 'run_tests',
          toolParams: { scope: 'affected' }
        }
      }
    }
  ]
};
```

### Template: Bug Fix

```typescript
const BUG_FIX_TEMPLATE: PlanTemplate = {
  name: 'bug_fix',
  description: 'Debug and fix code issues',
  steps: [
    {
      stepName: 'Understand the Bug',
      actionType: ActionType.LLM,
      config: {
        llm: {
          prompt: 'Analyze this bug: {request}\nCode: {code}'
        }
      }
    },
    {
      stepName: 'Find Related Code',
      actionType: ActionType.PTK,
      config: {
        ptk: {
          prompt: 'Find code related to this bug',
          tools: ['search_code', 'get_diagnostics']
        }
      }
    },
    {
      stepName: 'Generate Fix',
      actionType: ActionType.LLM,
      config: {
        llm: {
          prompt: 'Generate a fix for the bug based on analysis'
        }
      }
    },
    {
      stepName: 'Verify Fix',
      actionType: ActionType.TOOL,
      config: {
        tool: {
          toolName: 'run_tests',
          toolParams: { scope: 'related' }
        }
      }
    }
  ]
};
```

---

## LLM Planning Prompt

### Prompt Template

```markdown
You are an AI coding task planner. Create an execution plan.

**Task:** {request}

**Context:**
- Files affected: {fileCount}
- Code size: {lineCount} lines
- Language: {language}
- Complexity: {complexity}

Create a JSON plan with steps:

{
  "title": "Plan title",
  "description": "What this plan does",
  "estimatedTime": "30-45 seconds",
  "steps": [
    {
      "stepName": "Step 1",
      "stepDescription": "What this step does",
      "actionType": "llm" | "tool" | "ptk",
      "config": {
        "llm": { "prompt": "..." },
        "tool": { "toolName": "...", "toolParams": {...} },
        "ptk": { "prompt": "...", "tools": [...] }
      },
      "requiredTools": ["tool1"],
      "estimatedTime": 10000,
      "maxRetries": 2
    }
  ]
}

Rules:
- Keep steps focused and atomic
- Use PTK for steps that may need multiple tools
- Use LLM for analysis/generation
- Use TOOL for deterministic operations
- Order steps logically
- Estimate realistic time (ms)
```

---

## Dynamic Plan Updates

### Insert Step After

```typescript
insertStepAfter(
  plan: Plan,
  afterStepId: string,
  newStep: Step
): Plan {
  const afterStep = this.findStep(plan, afterStepId);
  
  if (!afterStep) {
    throw new Error(`Step ${afterStepId} not found`);
  }
  
  // Insert in linked list
  newStep.next = afterStep.next;
  newStep.prev = afterStep;
  
  if (afterStep.next) {
    afterStep.next.prev = newStep;
  }
  
  afterStep.next = newStep;
  
  // Update steps array
  const index = plan.steps.findIndex(s => s.stepId === afterStepId);
  plan.steps.splice(index + 1, 0, newStep);
  
  // Renumber steps
  this.renumberSteps(plan);
  
  // Log update
  plan.updateHistory.push({
    timestamp: new Date(),
    type: 'insert',
    stepId: newStep.stepId,
    reason: 'Dynamic insertion during execution'
  });
  
  return plan;
}
```

### Usage Example: Dynamic Update

```typescript
// During execution, Step 2 found more files than expected
// Execution Manager notifies Plan Manager

const updatedPlan = planManager.insertStepAfter(
  currentPlan,
  'step-2',
  {
    stepId: 'step-2.5',
    stepName: 'Analyze Additional Files',
    actionType: ActionType.PTK,
    config: {
      ptk: {
        prompt: 'Analyze the 10 additional files found',
        tools: ['read_file', 'search_code']
      }
    },
    status: StepStatus.PENDING,
    retryCount: 0,
    maxRetries: 2
  }
);

// Continue execution with updated plan
```

---

## Validation

### Validation Rules

```typescript
validatePlan(plan: Plan): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];
  
  // 1. Check plan has steps
  if (plan.steps.length === 0) {
    errors.push({
      code: 'EMPTY_PLAN',
      message: 'Plan must have at least one step'
    });
  }
  
  // 2. Check linked list integrity
  if (!this.validateLinkedList(plan)) {
    errors.push({
      code: 'BROKEN_LINKS',
      message: 'Step links are broken'
    });
  }
  
  // 3. Check each step
  for (const step of plan.steps) {
    // Valid action type
    if (!Object.values(ActionType).includes(step.actionType)) {
      errors.push({
        code: 'INVALID_ACTION_TYPE',
        message: `Invalid action type: ${step.actionType}`,
        stepId: step.stepId
      });
    }
    
    // Has config for action type
    if (step.actionType === ActionType.LLM && !step.config.llm) {
      errors.push({
        code: 'MISSING_CONFIG',
        message: 'LLM step missing config.llm',
        stepId: step.stepId
      });
    }
    
    // Valid dependencies
    for (const depId of step.dependsOn) {
      if (!plan.steps.find(s => s.stepId === depId)) {
        errors.push({
          code: 'INVALID_DEPENDENCY',
          message: `Step depends on non-existent step: ${depId}`,
          stepId: step.stepId
        });
      }
    }
  }
  
  // 4. Warnings
  if (plan.steps.length > 10) {
    warnings.push({
      code: 'LONG_PLAN',
      message: 'Plan has more than 10 steps, consider splitting'
    });
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}
```

---

## Error Handling

```typescript
class PlanGenerationError extends Error {
  constructor(
    message: string,
    public code: PlanErrorCode,
    public context?: any
  ) {
    super(message);
  }
}

enum PlanErrorCode {
  TEMPLATE_NOT_FOUND = 'TEMPLATE_NOT_FOUND',
  LLM_GENERATION_FAILED = 'LLM_GENERATION_FAILED',
  INVALID_PLAN_STRUCTURE = 'INVALID_PLAN_STRUCTURE',
  STEP_NOT_FOUND = 'STEP_NOT_FOUND',
  CIRCULAR_DEPENDENCY = 'CIRCULAR_DEPENDENCY'
}
```

---

## Dependencies

```typescript
interface IPlanManager {
  constructor(
    private llmManager: ILLMManager,
    private contextManager: IContextManager,
    private templates: Map<string, PlanTemplate>,
    private config: PlanManagerConfig
  );
}

interface PlanManagerConfig {
  defaultPlanningModel: string;
  planningTemperature: number;
  maxPlanSteps: number;
  enableDynamicUpdates: boolean;
  validateBeforeExecution: boolean;
}
```

---

## Usage Examples

### Example 1: Generate Plan from Template

```typescript
const plan = await planManager.generatePlan(
  "Refactor authentication to use JWT",
  { complexity: 'complex', confidence: 0.9 },
  context
);

// Uses REFACTORING_TEMPLATE
// Returns plan with 4 steps ready to execute
```

### Example 2: Generate Custom Plan via LLM

```typescript
const plan = await planManager.generatePlan(
  "Add dark mode support to the entire app",
  { complexity: 'complex', confidence: 0.85 },
  context
);

// No template found, uses LLM to generate custom plan
```

### Example 3: Dynamic Update During Execution

```typescript
// Execution finds tests failed at Step 4
const updatedPlan = planManager.appendStep(plan, {
  stepId: 'step-5',
  stepName: 'Fix Test Failures',
  actionType: ActionType.PTK,
  config: {
    ptk: {
      prompt: 'Fix the failing tests',
      tools: ['read_file', 'run_tests']
    }
  },
  status: StepStatus.PENDING,
  retryCount: 0,
  maxRetries: 3
});
```
