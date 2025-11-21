# Cấu Trúc Hệ Thống AI Agent

## Tổng Quan

Hệ thống gồm 6 Managers chính, hoạt động theo workflow tuyến tính với dynamic plan updates.

---

## Architecture Diagram

```
User Request (VS Code)
    ↓
┌─────────────────────────────────────┐
│ 1. COMPLEXITY MANAGER               │
│ - Heuristic check                   │
│ - LLM classification (if needed)    │
│ - Route: Simple vs Complex          │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│ 2. PLAN MANAGER                     │
│ - Generate plan (template/LLM)      │
│ - Validate plan                     │
│ - Dynamic updates                   │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│ 3. EXECUTION MANAGER                │
│ - Execute steps sequentially        │
│ - Trigger callbacks                 │
│ - Handle errors & retries           │
│ - Track progress                    │
└─────────────────────────────────────┘
    ↓
    ├─────────────────┬─────────────────┐
    ↓                 ↓                 ↓
┌─────────┐    ┌─────────┐    ┌─────────┐
│ 4. LLM  │    │ 5. TOOL │    │ 6. CTX  │
│ MANAGER │    │ MANAGER │    │ MANAGER │
└─────────┘    └─────────┘    └─────────┘
    ↓
Show Result (Inline Diff)
```

---

## Core Components

### 1. Complexity Manager

**Responsibilities**:
- Đánh giá độ phức tạp của request
- Quyết định Simple Path vs Complex Path

**Input**:
- User request
- Selected code
- File count, code size

**Output**:
```
{
  complexity: "simple" | "complex",
  confidence: 0.8-1.0,
  reason: string
}
```

**Methods**:
- `assessComplexity(request, context)` → complexity
- `heuristicCheck()` → quick assessment
- `llmClassify()` → accurate classification

---

### 2. Plan Manager

**Responsibilities**:
- Tạo execution plan
- Validate plan
- Dynamic updates (insert, append, remove steps)

**Input**:
- User request
- Complexity level
- Code context

**Output**:
```
Plan {
  planId: string
  steps: Step[]
  estimatedTime: string
  estimatedCost: string
}
```

**Methods**:
- `generatePlan(request, complexity)` → Plan
- `validatePlan(plan)` → boolean
- `insertStep(afterStepId, newStep)` → void
- `appendStep(step)` → void
- `removeStep(stepId)` → void

**Plan Generation**:
- Simple path: No planning (direct execution)
- Complex path: Template-based hoặc LLM-generated

---

### 3. Execution Manager

**Responsibilities**:
- Execute steps tuần tự
- Manage execution state
- Trigger callbacks
- Handle errors và retries
- Track progress

**Input**:
- Plan (from Plan Manager)
- Context (from Context Manager)

**Output**:
- Execution result
- Updated context

**Methods**:
- `execute(plan)` → Result
- `executeStep(step)` → StepResult
- `handleError(step, error)` → retry/abort
- `triggerCallbacks(event, data)` → void

**Execution Flow**:
```
current = plan.firstStep
while (current != null):
  1. Trigger onStepStart
  2. Execute step (via LLM/Tool Manager)
  3. Check result
  4. Decide: continue / update plan / abort
  5. Trigger onStepEnd
  6. current = current.next
```

---

### 4. LLM Manager

**Responsibilities**:
- Gọi LLM (API hoặc chatbot automation)
- Build prompts
- Parse responses

**Input**:
- Step config (prompt, model, temperature)
- Context

**Output**:
- LLM response (text/code)

**Methods**:
- `call(prompt, config)` → response
- `buildPrompt(step, context)` → prompt
- `parseResponse(response)` → structured data

**Implementations**:
- ChatGPT Web Automation (Puppeteer)
- OpenAI API (backup/comparison)

---

### 5. Tool Manager

**Responsibilities**:
- Execute tools (read_file, run_tests, search, etc.)
- Manage tool registry

**Input**:
- Tool name
- Tool parameters

**Output**:
- Tool execution result

**Methods**:
- `execute(toolName, params)` → result
- `registerTool(name, handler)` → void
- `listTools()` → string[]

**Built-in Tools**:
- `read_file`: Đọc file
- `write_file`: Ghi file
- `search_files`: Tìm files
- `run_tests`: Chạy tests
- `get_diagnostics`: Lấy errors/warnings

---

### 6. Context Manager

**Responsibilities**:
- Quản lý shared context
- Pass context giữa steps
- Update context sau mỗi step

**Context Structure**:
```
Context {
  // Original request
  userRequest: string
  selectedCode: string
  filePath: string
  
  // Execution state
  currentPlan: Plan
  completedSteps: StepResult[]
  
  // Accumulated data
  discoveries: string[]
  errors: Error[]
  
  // Project info
  projectInfo: object
}
```

**Methods**:
- `get(key)` → value
- `set(key, value)` → void
- `update(updates)` → void
- `merge(newContext)` → void

---

## Data Structures

### Step

```
Step {
  // Identity
  stepId: string
  stepName: string
  stepDescription: string
  
  // Action
  actionType: "llm" | "tool"
  config: {
    // LLM config
    prompt?: string
    model?: string
    temperature?: number
    
    // Tool config
    toolName?: string
    toolParams?: object
  }
  
  // Execution
  status: "pending" | "running" | "completed" | "failed"
  input: any
  output: any
  error?: Error
  
  // Timing
  startTime?: timestamp
  endTime?: timestamp
  duration?: number
  
  // Retry
  retryCount: number
  maxRetries: number
  
  // Link
  next: Step | null
}
```

---

### Plan

```
Plan {
  // Identity
  planId: string
  
  // Steps
  steps: Step[]
  firstStep: Step
  currentStep: Step
  
  // Metadata
  status: "idle" | "running" | "completed" | "failed"
  estimatedTime: string
  estimatedCost: string
  
  // Context
  context: Context
}
```

---

## Workflow Example

### Simple Request: "Rename variable"

```
1. Complexity Manager
   Input: "Rename variable x to y"
   Output: complexity = "simple"

2. Plan Manager
   Skip (simple path không cần plan)

3. Execution Manager
   Execute: Direct LLM call
   
4. LLM Manager
   Call LLM với prompt: "Rename variable x to y in this code"
   Return: Refactored code

5. Show inline diff
```

**Total time**: 2-5 seconds
**LLM calls**: 1

---

### Complex Request: "Refactor authentication"

```
1. Complexity Manager
   Input: "Refactor authentication system"
   Output: complexity = "complex"

2. Plan Manager
   Generate plan:
     Step1: Analyze current auth (LLM)
     Step2: Find auth files (Tool)
     Step3: Generate refactored code (LLM)
     Step4: Run tests (Tool)

3. Execution Manager
   Execute Step1 (LLM Manager)
     → Result: Analysis complete
   
   Execute Step2 (Tool Manager)
     → Result: Found 5 files (unexpected!)
   
   [Dynamic Update]
   Plan Manager: Insert Step2.5: Analyze additional files
   
   Execute Step2.5 (LLM Manager)
     → Result: Additional analysis
   
   Execute Step3 (LLM Manager)
     → Result: Refactored code
   
   Execute Step4 (Tool Manager)
     → Result: Tests FAILED
   
   [Dynamic Update]
   Plan Manager: Append Step5: Fix bugs, Step6: Run tests
   
   Execute Step5 (LLM Manager)
     → Result: Fixed code
   
   Execute Step6 (Tool Manager)
     → Result: Tests PASSED

4. Show inline diff
```

**Total time**: 45-60 seconds
**LLM calls**: 5
**Dynamic updates**: 2

---

## Communication Flow

### Between Managers

```
Complexity Manager
    ↓ (complexity level)
Plan Manager
    ↓ (plan)
Execution Manager
    ↓ (step)
LLM/Tool Manager
    ↓ (result)
Context Manager (update)
    ↓ (updated context)
Execution Manager (next step)
```

### Context Passing

```
Every step receives:
  - Full context
  - Step config
  
Every step returns:
  - Step result
  - Context updates
```

---

## Error Handling

### Retry Strategy

```
Step fails
    ↓
Check retryCount < maxRetries
    ├─ Yes: Retry step
    └─ No: Check fallback
        ├─ Has fallback: Execute fallback
        └─ No fallback: Abort or continue
```

### Error Types

**LLM Errors**:
- Rate limit → Retry with backoff
- Invalid response → Retry with modified prompt
- Timeout → Retry or abort

**Tool Errors**:
- File not found → Ask user or skip
- Test failed → Fix and retry
- Permission denied → Abort

---

## Callbacks/Events

### Execution Events

```
onExecutionStart(plan)
onStepStart(step)
onStepEnd(step, result)
onStepError(step, error)
onPlanUpdate(oldPlan, newPlan)
onExecutionEnd(result)
```

### Usage

**Progress Tracking**:
```
onStepStart → Update progress bar
onStepEnd → Mark step complete
```

**Logging**:
```
onStepStart → Log "Starting step X"
onStepError → Log error details
```

**UI Updates**:
```
onStepEnd → Show intermediate results
onExecutionEnd → Show final diff
```

---

## Implementation Phases

### Phase 1: MVP (Essential)

**Managers**:
- Complexity Manager (heuristic only)
- Plan Manager (template-based)
- Execution Manager (basic)
- LLM Manager (chatbot automation)
- Tool Manager (basic tools)
- Context Manager

**Features**:
- Simple path (direct execution)
- Complex path (template plans)
- Basic error handling
- Inline diff

---

### Phase 2: Enhanced

**Add**:
- LLM-based complexity classification
- LLM-generated plans
- Advanced error handling
- More tools
- Better callbacks

---

### Phase 3: Advanced

**Add**:
- Caching
- Metrics
- Optimization
- Advanced UI

---

## Summary

**6 Managers**: Complexity, Plan, Execution, LLM, Tool, Context

**2 Paths**: Simple (1 LLM call) vs Complex (multiple steps)

**Dynamic Updates**: Plan thay đổi runtime based on results

**Linear Execution**: Steps execute tuần tự, không có loops/branches trong structure

**Callbacks**: Events cho progress tracking, logging, UI updates
