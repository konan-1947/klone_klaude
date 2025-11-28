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
    ├──────────────┬──────────────┬─────────────┬──────────────┐
    ↓              ↓              ↓             ↓              ↓
┌────────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌──────────────┐
│    PTK     │ │   LLM   │ │  TOOL   │ │ CONTEXT │ │   IGNORE     │
│  MANAGER   │ │ MANAGER │ │ MANAGER │ │ MANAGER │ │   MANAGER    │
│            │ │         │ │         │ │         │ │              │
│ - Format   │ │ - Call  │ │ - Exec  │ │ - State │ │ - Auto scan  │
│ - Parse    │ │   LLM   │ │   tools │ │   store │ │ - Track chg  │
│ - Tool loop│ │         │ │    ↑    │ │         │ │ - .aiignore  │
└────────────┘ └─────────┘ └────┼────┘ └─────────┘ └──────┬───────┘
                                │                         │
                                └─────────────────────────┘
                                     Tool uses Ignore
    ↓
Show Result (Inline Diff)
```

**Manager Roles:**
- **Complexity Manager**: Đánh giá độ phức tạp request
- **Plan Manager**: Tạo execution plan (steps)
- **Execution Manager**: Điều phối thực thi plan
- **PTK Manager**: Gateway cho tool calling (format prompts, parse responses, orchestrate loop)
- **LLM Manager**: Gọi LLM providers (AI Studio, OpenAI, etc.)
- **Tool Manager**: Execute tools (read_file, search_code, etc.)
- **Context Manager**: Quản lý state/context cho agent
- **Ignore Manager**: Tự động phát hiện & quản lý files không nên đọc (libraries, env, build...)

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

### 4. PTK Manager

**Responsibilities**:
- Format prompts cho tool calling
- Parse LLM responses để detect tool calls
- Orchestrate tool calling loop (LLM ↔ Tool)
- Manage conversation history trong tool calling session

**Input**:
- User prompt
- Available tools
- Context

**Output**:
- Final response (sau khi complete tool calling loop)

**Methods**:
- `execute(prompt, tools)` → response
- `formatPrompt(prompt, tools, context)` → formatted prompt
- `parseResponse(response)` → { type: 'text' | 'tool_call', ... }
- `executeToolLoop(prompt, tools)` → final response

**Components**:
- **PTKFormatter**: Build prompts với tool definitions
- **PTKParser**: Parse responses, detect `<PTK_CALL>` tags
- **PTKExecutor**: Orchestrate loop giữa LLM và Tool

**Dependencies**:
- Uses **LLM Manager** để gọi LLM
- Uses **Tool Manager** để execute tools
- Uses **Context Manager** để read/write conversation history

**Flow**:
```
1. Format prompt với tool definitions
2. Call LLM Manager
3. Parse response
4. If tool_call detected:
   - Execute tool via Tool Manager
   - Add result to conversation
   - Loop back to step 2
5. Else: Return text response
```

---

### 5. LLM Manager

**Responsibilities**:
- Gọi LLM providers (AI Studio, OpenAI, Claude, etc.)
- NO prompt building (PTK Manager làm việc đó)
- NO response parsing for tool calls (PTK Manager làm việc đó)

**Input**:
- Prompt (đã được format bởi PTK Manager hoặc Execution Manager)
- Config (model, temperature, max_tokens)

**Output**:
- Raw LLM response (text)

**Methods**:
- `call(prompt, config)` → response

**Implementations**:
- AI Studio Browser Automation (Puppeteer)
- OpenAI API
- Anthropic Claude API
- Local models (Ollama)

---

### 6. Tool Manager

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

### 7. Context Manager

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

### 8. Ignore Manager 🔒

**Responsibilities**:
- Tự động phát hiện và track những files không nên đọc
- Quản lý `.aiignore` file (tự động generate và update)
- Monitor project changes và cập nhật ignore list
- Validate file access trước khi tools thực thi

**Input**:
- Project root path
- File system changes (via watcher)

**Output**:
```
{
  allowed: boolean
  reason?: string
  category?: "library" | "env" | "build" | "cache" | "sensitive"
}
```

**Methods**:
- `initialize()` → Scan project + load .aiignore
- `scanProject()` → Phát hiện auto-ignore patterns
- `validateAccess(path)` → Check if file accessible
- `updateIgnoreFile()` → Update .aiignore với patterns mới
- `watchFileChanges()` → Monitor và auto-update
- `getIgnoreCategories()` → List categories of ignored files
- `dispose()` → Cleanup watchers

**Auto-Detection Categories**:

1. **Dependencies/Libraries**:
   ```
   node_modules/
   vendor/
   packages/
   .pnpm-store/
   bower_components/
   ```

2. **Environment/Config**:
   ```
   .env
   .env.*
   secrets/
   *.key
   *.pem
   config.local.*
   ```

3. **Build Outputs**:
   ```
   dist/
   build/
   out/
   target/
   *.min.js
   *.bundle.js
   ```

4. **Cache/Temp**:
   ```
   .cache/
   tmp/
   temp/
   *.log
   .next/
   .nuxt/
   ```

5. **Version Control**:
   ```
   .git/
   .svn/
   .hg/
   ```

6. **IDE/Editor**:
   ```
   .vscode/
   .idea/
   *.swp
   .DS_Store
   ```

**Features**:

**1. Initial Scan**:
```
1. Đọc toàn bộ project structure
2. Detect patterns (node_modules, .env, etc.)
3. Generate initial .aiignore file
4. Load existing .gitignore (optional merge)
```

**2. Real-time Monitoring**:
```
1. Watch file system changes
2. Detect new directories/files matching patterns
3. Auto-update .aiignore
4. Notify user về updates
```

**3. Smart Detection**:
- **Size-based**: Auto-ignore folders > 10MB
- **Pattern-based**: Match known library/build patterns  
- **Extension-based**: Binary files, compiled outputs
- **Convention-based**: Standard framework directories

**4. User Control**:
- Manual overrides in `.aiignore`
- Whitelist patterns với `!`
- Include từ files khác: `!include .gitignore`
- Comments và organization

**.aiignore File Format**:
```bash
# Auto-generated by AI Agent
# Last updated: 2025-11-28 11:14:25

# === Dependencies (auto-detected) ===
node_modules/
.pnpm-store/

# === Environment (auto-detected) ===
.env
.env.*
secrets/

# === Build outputs (auto-detected) ===
dist/
*.min.js

# === User-defined ===
# Add your custom patterns here
my-secret-folder/

# === Include from other files ===
!include .gitignore
```

**Integration với Tool Manager**:
```
Tool Manager calls:
  1. ignoreManager.validateAccess(path)
  2. If denied → return error to LLM
  3. If allowed → proceed with tool execution
```

**Workflow**:
```
┌─────────────────────────────────────┐
│ 1. Initialize                       │
│    - Scan project                   │
│    - Generate .aiignore             │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│ 2. Monitor Changes                  │
│    - File watcher active            │
│    - Detect new patterns            │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│ 3. Auto-Update                      │
│    - Add new patterns               │
│    - Update .aiignore               │
│    - Notify user                    │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│ 4. Validate Access                  │
│    - Called by Tool Manager         │
│    - Check against ignore rules     │
│    - Return allowed/denied          │
└─────────────────────────────────────┘
```

**Performance**:
- Cache ignore patterns in memory
- Debounce file watcher updates (300ms)
- Incremental updates (không rescan toàn bộ)
- Lazy loading cho large projects

**Security**:
- Self-ignore: `.aiignore` không thể bị AI đọc
- Fail-safe: Nếu không có file → allow all
- Override protection: User-defined patterns prioritized

**Example Implementation**:
```typescript
class IgnoreManager {
  private ignorePatterns: Set<string>
  private fileWatcher: FileWatcher
  private ignoreCache: Map<string, boolean>
  
  async initialize(projectRoot: string) {
    // 1. Scan project
    const patterns = await this.scanProject(projectRoot)
    
    // 2. Load existing .aiignore
    const existingPatterns = await this.loadAiIgnore()
    
    // 3. Merge patterns
    this.ignorePatterns = new Set([...patterns, ...existingPatterns])
    
    // 4. Generate/update .aiignore
    await this.updateIgnoreFile()
    
    // 5. Setup file watcher
    this.setupFileWatcher(projectRoot)
  }
  
  validateAccess(filePath: string): boolean {
    // Check cache first
    if (this.ignoreCache.has(filePath)) {
      return this.ignoreCache.get(filePath)!
    }
    
    // Check against patterns
    const allowed = !this.matchesAnyPattern(filePath)
    this.ignoreCache.set(filePath, allowed)
    return allowed
  }
  
  private async scanProject(root: string) {
    const patterns = new Set<string>()
    
    // Detect node_modules
    if (await exists(join(root, 'node_modules'))) {
      patterns.add('node_modules/')
    }
    
    // Detect .env files
    const envFiles = await glob(join(root, '.env*'))
    envFiles.forEach(f => patterns.add(basename(f)))
    
    // ... more detection logic
    
    return Array.from(patterns)
  }
}
```

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
- **Ignore Manager** (auto-detect + .aiignore)

**Features**:
- Simple path (direct execution)
- Complex path (template plans)
- Basic error handling
- Inline diff
- **Auto file ignore với security** (.aiignore auto-generation)

---

### Phase 2: Enhanced

**Add**:
- LLM-based complexity classification
- LLM-generated plans
- Advanced error handling
- More tools
- Better callbacks
- **Ignore Manager enhancements**: LLM-suggested ignore patterns

---

### Phase 3: Advanced

**Add**:
- Caching
- Metrics
- Optimization
- Advanced UI
- **Smart ignore analytics**: Usage statistics, optimization suggestions

---

## Summary

**8 Managers**: Complexity, Plan, Execution, PTK, LLM, Tool, Context, **Ignore**

**2 Paths**: Simple (1 LLM call) vs Complex (multiple steps)

**Dynamic Updates**: Plan thay đổi runtime based on results

**Linear Execution**: Steps execute tuần tự, không có loops/branches trong structure

**Callbacks**: Events cho progress tracking, logging, UI updates

**Security**: Ignore Manager tự động phát hiện và protect sensitive files
