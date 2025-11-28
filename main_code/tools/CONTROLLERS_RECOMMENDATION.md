# Đề xuất Controllers/Managers cho main_code

## Tổng quan

Dựa trên:
- **Codebase hiện tại** của main_code
- **SYSTEM_ARCHITECTURE.md** (6 Managers đã thiết kế)
- **Cline's best practices** (Controllers pattern)
- **File Operations tools** (5 tools cần implement)

## Managers hiện có trong main_code

✅ **CookieManager** (`src/core/cookie/CookieManager.ts`)
- Quản lý cookies/sessions
- Persistence to disk
- ✅ Đã implement tốt

✅ **AIStudioBrowser** (`src/core/browser/AIStudioBrowser.ts`)
- Browser automation
- Puppeteer wrapper
- ✅ Đã implement tốt

---

## Managers CẦN THÊM theo SYSTEM_ARCHITECTURE.md

### 🎯 **Essential (Phase 1 - MVP)**

#### 1. ✅ **ToolManager** - PRIORITY 1
**Tại sao cần?**
- Để execute 5 File Operations tools
- Core functionality cho AI agent
- Phụ thuộc bởi PTKManager và ExecutionManager

**Responsibilities:**
```typescript
class ToolManager {
  // Registry
  private tools: Map<string, ToolHandler>
  
  // Core APIs
  registerTool(name: string, handler: ToolHandler)
  execute(toolName: string, params: object): Promise<ToolResult>
  listTools(): ToolDefinition[]
  
  // Validation
  validateToolCall(name: string, params: object): boolean
}
```

**Implementation:**
- File: `src/core/tools/ToolManager.ts`
- Handlers: `src/core/tools/handlers/`
  - `ReadFileHandler.ts`
  - `WriteFileHandler.ts`
  - `ReplaceInFileHandler.ts`
  - `ListFilesHandler.ts`
  - `SearchFilesHandler.ts`

**Effort**: 3-4 ngày

---

#### 2. ✅ **LLMManager** - PRIORITY 2
**Tại sao cần?**
- Gateway để gọi LLM providers
- Hiện tại đang hardcode AI Studio, cần abstraction
- Dễ dàng thêm providers khác (OpenAI, Claude, Ollama)

**Responsibilities:**
```typescript
class LLMManager {
  // Provider management
  private providers: Map<string, LLMProvider>
  
  // Core API
  async call(prompt: string, config: LLMConfig): Promise<string>
  
  // Provider registration
  registerProvider(name: string, provider: LLMProvider)
  setActiveProvider(name: string)
}
```

**Providers:**
- `AIStudioProvider` (uses existing AIStudioBrowser)
- `OpenAIProvider` (future)
- `ClaudeProvider` (future)

**Implementation:**
- File: `src/core/llm/LLMManager.ts`
- Providers: `src/core/llm/providers/`

**Effort**: 2-3 ngày

---

#### 3. ✅ **ContextManager** - PRIORITY 3
**Tại sao cần?**
- Manage conversation state
- Pass context between execution steps
- Track accumulated data (file reads, discoveries...)

**Responsibilities:**
```typescript
class ContextManager {
  // State
  private context: Context
  
  // APIs
  get(key: string): any
  set(key: string, value: any): void
  update(updates: Partial<Context>): void
  clear(): void
  
  // Specialized
  addMessage(message: Message): void
  getConversationHistory(): Message[]
}
```

**Context Structure:**
```typescript
interface Context {
  userRequest: string
  selectedCode?: string
  filePath?: string
  
  conversationHistory: Message[]
  completedActions: Action[]
  
  // Project info
  projectRoot: string
  workspaceInfo: object
}
```

**Implementation:**
- File: `src/core/context/ContextManager.ts`

**Effort**: 1-2 ngày

---

#### 4. ⚠️ **PTKManager** - PRIORITY 4 (OPTIONAL Phase 1)
**Tại sao cần?**
- Orchestrate tool calling loop
- Format prompts + Parse responses
- Handle LLM ↔ Tool iteration

**Responsibilities:**
```typescript
class PTKManager {
  constructor(llmManager: LLMManager, toolManager: ToolManager)
  
  // Core API
  async execute(prompt: string, tools: string[]): Promise<string>
  
  // Internal
  private formatPrompt(prompt: string, tools: ToolDef[]): string
  private parseResponse(response: string): ParsedResponse
  private executeToolLoop(prompt: string): Promise<string>
}
```

**⚠️ Có thể skip Phase 1 vì:**
- Complex implementation
- Có thể dùng native function calling của LLM providers (nếu switch sang API)

**Implementation:**
- File: `src/core/ptk/PTKManager.ts`

**Effort**: 4-5 ngày

---

### 🔄 **Enhanced (Phase 2)**

#### 5. ⏸️ **ExecutionManager** - Phase 2
**Tại sao chưa cần ngay?**
- Phase 1 chỉ cần simple execution
- Complex workflow planning chưa cần thiết
- Có thể implement sau khi có tools stable

**When needed:**
- Khi cần multi-step workflows
- Khi cần dynamic plan updates
- Khi tasks trở nên complex hơn

---

#### 6. ⏸️ **PlanManager** - Phase 2
**Tại sao chưa cần ngay?**
- Phase 1 focus vào simple path (no planning)
- Template-based plans có thể hardcode
- LLM-generated plans là advanced feature

**When needed:**
- Khi cần plan generation
- Khi cần validate plans
- Khi cần dynamic updates

---

#### 7. ⏸️ **ComplexityManager** - Phase 2
**Tại sao chưa cần ngay?**
- Phase 1 có thể dùng simple heuristics
- Not a blocking dependency
- Can manual override initially

**When needed:**
- Khi cần auto-routing
- Khi optimize for performance
- Khi có nhiều execution paths

---

## Controllers từ Cline có thể áp dụng

### 🔒 **IgnoreManager** - HIGHLY RECOMMENDED (Enhanced version)

**Tại sao cần?**
- ✅ Security: Prevent AI access to sensitive files
- ✅ **Auto-detection**: Tự động phát hiện libraries, build outputs, env files
- ✅ **Smart tracking**: Monitor project changes và auto-update
- ✅ Essential cho File Operations tools

**Base từ Cline:** `ClineIgnoreController.ts` nhưng được **nâng cấp**

**Enhancements:**
- ✅ Auto-scan project structure at initialization
- ✅ Detect common patterns (node_modules, .env, dist, etc.)
- ✅ Generate `.aiignore` file tự động
- ✅ Real-time file watcher với auto-update
- ✅ Size-based detection (folders > 10MB)
- ✅ Smart categorization (libraries, env, build, cache)

**Implementation:**
- Base: Copy `ClineIgnoreController.ts` từ Cline
- Add: Auto-detection logic
- Add: `.aiignore` generation
- Add: Project scanner
- Integrate: Tools check `validateAccess()` before operations

**Effort**: 3-4 ngày (2 ngày base + 1-2 ngày auto-detection)

**Priority**: HIGH (should implement with ToolManager)

**Features so với ClineIgnoreController:**

| Feature | ClineIgnoreController | IgnoreManager ✨ |
|---------|----------------------|-----------------|
| Manual .clineignore | ✅ | ✅ |
| Gitignore syntax | ✅ | ✅ |
| File watcher | ✅ | ✅ Enhanced |
| Path validation | ✅ | ✅ |
| **Auto-scan project** | ❌ | ✅ NEW |
| **Auto-detect patterns** | ❌ | ✅ NEW |
| **Generate .aiignore** | ❌ | ✅ NEW |
| **Size-based filtering** | ❌ | ✅ NEW |
| **Category tracking** | ❌ | ✅ NEW |

**.aiignore vs .clineignore:**
```bash
# .aiignore - Auto-generated với categories
# Last updated: 2025-11-28 11:14:25

# === Dependencies (auto-detected) ===
node_modules/
vendor/

# === Environment (auto-detected) ===
.env
.env.*

# === Build (auto-detected) ===
dist/
*.min.js

# === User-defined ===
my-custom-ignore/

# === Include ===
!include .gitignore
```

---

### 📁 **WorkspaceRootManager** - OPTIONAL

**Tại sao xem xét?**
- Multi-workspace support
- Path resolution across workspaces
- Professional feature

**From Cline:** `src/core/workspace/WorkspaceRootManager.ts`

**Priority**: LOW (Phase 2+)
- Phase 1 chỉ cần single workspace
- Can add later when needed

---

### 💾 **StateManager** - OPTIONAL

**Tại sao xem xét?**
- Better state persistence than current approach
- Debounced writes
- Event callbacks

**From Cline:** `src/core/storage/StateManager.ts`

**Current approach:**
- CookieManager handles its own persistence ✅
- Simple and works

**Priority**: LOW
- Current persistence is adequate
- Can refactor later if needed

---

## Recommended Implementation Order

### **Phase 1: MVP (2-3 tuần)**

**Week 1:**
1. ✅ **IgnoreManager** (3-4 ngày)
   - Copy ClineIgnoreController từ Cline (1 ngày)
   - Add auto-scan project (1 ngày)
   - Add auto-detect patterns (1 ngày)
   - Generate `.aiignore` file (0.5 ngày)
   - Testing với real projects (0.5 ngày)

2. ✅ **ToolManager** (3-4 ngày)
   - Core registry (1 ngày)
   - 5 File Operations handlers (2 ngày)
   - Integrate IgnoreManager (0.5 ngày)
   - Error handling (0.5 ngày)

**Week 2:**
3. ✅ **ContextManager** (2 ngày)
   - Basic state management
   - Conversation history
   - Context passing

4. ✅ **LLMManager** (2-3 ngày)
   - Provider abstraction
   - AIStudioProvider (wrap existing AIStudioBrowser)
   - Config management

**Week 3:**
5. 🔗 **Integration** (3-4 ngày)
   - Wire managers together
   - Simple execution flow
   - End-to-end testing

**⚠️ Skip PTKManager Phase 1:**
- Too complex for MVP
- Can use simpler approach initially

---

### **Phase 2: Enhanced (2-3 tuần)**

**Week 4-5:**
6. ✅ **PTKManager** (4-5 ngày)
   - Tool calling loop
   - Prompt formatting
   - Response parsing

7. ✅ **ExecutionManager** (3-4 ngày)
   - Step-by-step execution
   - Error handling
   - Progress tracking

**Week 6:**
8. ✅ **PlanManager** (3-4 ngày)
   - Template-based plans
   - Plan validation
   - Dynamic updates

9. ⏸️ **ComplexityManager** (optional)

---

## Detailed Structure Proposal

### Proposed Directory Structure

```
src/
├── core/
│   ├── browser/
│   │   └── AIStudioBrowser.ts        # Existing ✅
│   │
│   ├── cookie/
│   │   └── CookieManager.ts          # Existing ✅
│   │
│   ├── ignore/                        # NEW ⭐
│   │   └── ClineIgnoreController.ts  # From Cline
│   │
│   ├── tools/                         # NEW ⭐⭐⭐
│   │   ├── ToolManager.ts            # Registry + Executor
│   │   ├── types.ts                  # Tool types/interfaces
│   │   └── handlers/
│   │       ├── ReadFileHandler.ts
│   │       ├── WriteFileHandler.ts
│   │       ├── ReplaceInFileHandler.ts
│   │       ├── ListFilesHandler.ts
│   │       └── SearchFilesHandler.ts
│   │
│   ├── llm/                           # NEW ⭐⭐
│   │   ├── LLMManager.ts             # Provider management
│   │   ├── types.ts                  # LLM types
│   │   └── providers/
│   │       ├── AIStudioProvider.ts   # Wrap AIStudioBrowser
│   │       ├── OpenAIProvider.ts     # Future
│   │       └── ClaudeProvider.ts     # Future
│   │
│   ├── context/                       # NEW ⭐
│   │   └── ContextManager.ts         # State + Conversation
│   │
│   ├── ptk/                           # Phase 2
│   │   └── PTKManager.ts
│   │
│   ├── execution/                     # Phase 2
│   │   └── ExecutionManager.ts
│   │
│   └── planning/                      # Phase 2
│       └── PlanManager.ts
```

---

## Implementation Examples

### Example 1: ToolManager

```typescript
// src/core/tools/ToolManager.ts
import { ClineIgnoreController } from '../ignore/ClineIgnoreController'
import { ReadFileHandler } from './handlers/ReadFileHandler'
import { WriteFileHandler } from './handlers/WriteFileHandler'
// ... other handlers

export class ToolManager {
  private tools = new Map<string, ToolHandler>()
  
  constructor(
    private ignoreController: ClineIgnoreController,
    private workspaceRoot: string
  ) {
    this.registerDefaultTools()
  }
  
  private registerDefaultTools() {
    this.registerTool('read_file', new ReadFileHandler(
      this.ignoreController,
      this.workspaceRoot
    ))
    this.registerTool('write_to_file', new WriteFileHandler(
      this.ignoreController,
      this.workspaceRoot
    ))
    // ... register other tools
  }
  
  registerTool(name: string, handler: ToolHandler) {
    this.tools.set(name, handler)
  }
  
  async execute(
    toolName: string, 
    params: Record<string, any>
  ): Promise<ToolResult> {
    const handler = this.tools.get(toolName)
    if (!handler) {
      throw new Error(`Tool not found: ${toolName}`)
    }
    
    return await handler.execute(params)
  }
  
  listTools(): ToolDefinition[] {
    return Array.from(this.tools.entries()).map(([name, handler]) => ({
      name,
      description: handler.getDescription(),
      parameters: handler.getParameters()
    }))
  }
}
```

### Example 2: LLMManager

```typescript
// src/core/llm/LLMManager.ts
import { AIStudioProvider } from './providers/AIStudioProvider'

export class LLMManager {
  private providers = new Map<string, LLMProvider>()
  private activeProvider: string = 'ai-studio'
  
  constructor() {
    // Register default provider
    this.registerProvider('ai-studio', new AIStudioProvider())
  }
  
  registerProvider(name: string, provider: LLMProvider) {
    this.providers.set(name, provider)
  }
  
  setActiveProvider(name: string) {
    if (!this.providers.has(name)) {
      throw new Error(`Provider not found: ${name}`)
    }
    this.activeProvider = name
  }
  
  async call(
    prompt: string, 
    config?: LLMConfig
  ): Promise<string> {
    const provider = this.providers.get(this.activeProvider)
    if (!provider) {
      throw new Error(`No active provider`)
    }
    
    return await provider.call(prompt, config)
  }
}
```

### Example 3: ContextManager

```typescript
// src/core/context/ContextManager.ts

export class ContextManager {
  private context: Context = {
    conversationHistory: [],
    completedActions: [],
    projectRoot: '',
    workspaceInfo: {}
  }
  
  get<K extends keyof Context>(key: K): Context[K] {
    return this.context[key]
  }
  
  set<K extends keyof Context>(key: K, value: Context[K]): void {
    this.context[key] = value
  }
  
  update(updates: Partial<Context>): void {
    this.context = { ...this.context, ...updates }
  }
  
  addMessage(message: Message): void {
    this.context.conversationHistory.push(message)
  }
  
  getConversationHistory(): Message[] {
    return this.context.conversationHistory
  }
  
  clear(): void {
    this.context = {
      conversationHistory: [],
      completedActions: [],
      projectRoot: this.context.projectRoot,
      workspaceInfo: this.context.workspaceInfo
    }
  }
}
```

---

## Integration Pattern

### How Managers Work Together

```typescript
// In ChatViewProvider or main execution flow

class AgentOrchestrator {
  private toolManager: ToolManager
  private llmManager: LLMManager
  private contextManager: ContextManager
  private ignoreController: ClineIgnoreController
  
  async initialize(context: vscode.ExtensionContext) {
    // 1. Setup ignore controller
    this.ignoreController = new ClineIgnoreController(workspaceRoot)
    await this.ignoreController.initialize()
    
    // 2. Setup tool manager
    this.toolManager = new ToolManager(
      this.ignoreController,
      workspaceRoot
    )
    
    // 3. Setup LLM manager
    this.llmManager = new LLMManager()
    
    // 4. Setup context manager
    this.contextManager = new ContextManager()
  }
  
  async handleUserRequest(request: string) {
    // 1. Add to context
    this.contextManager.set('userRequest', request)
    
    // 2. Call LLM
    const tools = this.toolManager.listTools()
    const prompt = this.buildPrompt(request, tools)
    const response = await this.llmManager.call(prompt)
    
    // 3. Parse and execute tools if needed
    const toolCalls = this.parseToolCalls(response)
    for (const call of toolCalls) {
      const result = await this.toolManager.execute(
        call.name,
        call.params
      )
      this.contextManager.addMessage({
        role: 'tool',
        content: result
      })
    }
    
    // 4. Get final response
    // ...
  }
}
```

---

## Testing Strategy

### Unit Tests
```typescript
// __tests__/ToolManager.test.ts
describe('ToolManager', () => {
  it('should register and execute tools', async () => {
    const toolManager = new ToolManager(ignoreController, workspaceRoot)
    const result = await toolManager.execute('read_file', { 
      path: 'test.txt' 
    })
    expect(result.success).toBe(true)
  })
})
```

### Integration Tests
```typescript
// __tests__/integration/tool-execution.test.ts
describe('Tool Execution Flow', () => {
  it('should execute read_file → LLM → write_file flow', async () => {
    // Test complete workflow
  })
})
```

---

## Migration Path

### From Current to New Architecture

**Current:**
```typescript
// Direct browser usage
const browser = new AIStudioBrowser(...)
await browser.initialize()
const response = await browser.sendPrompt(userRequest)
```

**New (Phase 1):**
```typescript
// Manager-based
const orchestrator = new AgentOrchestrator()
await orchestrator.initialize(context)
const response = await orchestrator.handleUserRequest(userRequest)

// Tools are now available automatically
// LLM can call read_file, write_file, etc.
```

---

## Risk Assessment

### Low Risk
- ✅ ClineIgnoreController: Proven code from Cline
- ✅ ContextManager: Simple state management
- ✅ LLMManager: Thin wrapper around existing browser

### Medium Risk
- ⚠️ ToolManager: Core functionality, needs thorough testing
- ⚠️ Integration: Wiring everything together

### High Risk
- 🔴 PTKManager: Complex parsing logic
- 🔴 ExecutionManager: Workflow orchestration

**Mitigation:**
- Start with low-risk components
- Thorough testing at each step
- Incremental integration

---

## Success Metrics

### Phase 1 Complete When:
- ✅ 5 File Operations tools working
- ✅ ClineIgnoreController protecting sensitive files
- ✅ LLM can call tools successfully
- ✅ Context maintained across operations
- ✅ Error handling robust
- ✅ End-to-end flow tested

### Phase 2 Complete When:
- ✅ PTK tool calling loop working
- ✅ Multi-step workflows supported
- ✅ Plan generation working
- ✅ Dynamic plan updates functional

---

## Conclusion

### Recommended for Phase 1:
1. ✅ **IgnoreManager** (enhanced from ClineIgnoreController)
   - Auto-scan project
   - Auto-detect patterns (libraries, env, build...)
   - Generate `.aiignore` automatically
   - Real-time monitoring
2. ✅ **ToolManager** (new, với 5 handlers)
3. ✅ **ContextManager** (new, simple)
4. ✅ **LLMManager** (new, wrapper)

### Skip Phase 1:
- ❌ PTKManager (too complex)
- ❌ ExecutionManager (not needed yet)
- ❌ PlanManager (not needed yet)
- ❌ ComplexityManager (not needed yet)
- ❌ WorkspaceRootManager (single workspace OK)
- ❌ StateManager (current approach OK)

### Total Effort: 2-3 tuần cho Phase 1 MVP

Sau Phase 1, bạn sẽ có một working AI agent với:
- ✅ 5 file operation tools
- ✅ **Smart security controls** (auto-detect ignored files)
- ✅ Extensible architecture để thêm features sau
- ✅ **Production-ready ignore system** với `.aiignore` auto-generation
