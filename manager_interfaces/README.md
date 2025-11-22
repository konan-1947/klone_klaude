# Manager Interfaces - README

## Overview

Thư mục này chứa thiết kế interface chi tiết cho 7 managers trong AI Agent system. Mỗi file định nghĩa:

- Interface methods và signatures
- Type definitions
- Implementation strategies
- Dependencies giữa managers
- Usage examples
- Error handling
- Testing approach

---

## Managers

### 1. ComplexityManager.md

**Responsibility:** Đánh giá độ phức tạp của user request để route Simple vs Complex path

**Key Interfaces:**
- `assessComplexity()` - Hybrid approach (heuristic + LLM)
- `heuristicCheck()` - Fast keyword-based classification
- `llmClassify()` - Accurate LLM-based classification

**Dependencies:**
- LLM Manager (cho LLM classification)
- Context Manager (lấy project context)

---

### 2. PlanManager.md

**Responsibility:** Tạo và quản lý execution plan, support dynamic updates

**Key Interfaces:**
- `generatePlan()` - Template-based hoặc LLM-generated
- `validatePlan()` - Validate structure và logic
- `insertStepAfter()`, `appendStep()`, `removeStep()` - Dynamic updates

**Dependencies:**
- LLM Manager (cho LLM-generated plans)
- Context Manager (cho plan context)

---

### 3. ExecutionManager.md

**Responsibility:** Orchestrate execution của plan, execute steps, handle errors

**Key Interfaces:**
- `executePlan()` - Main execution loop
- `executeStep()` - Execute single step (LLM/Tool/PTK)
- `pause()`, `resume()`, `cancel()` - Execution control
- Event system: `on()` - Register callbacks

**Dependencies:**
- Plan Manager (validate plans, dynamic updates)
- PTK Manager (execute PTK steps)
- LLM Manager (execute LLM steps)
- Tool Manager (execute Tool steps)
- Context Manager (pass context giữa steps)

---

### 4. LLMManager.md

**Responsibility:** Gọi LLM providers (AI Studio, OpenAI, Claude, Ollama)

**Key Interfaces:**
- `call()` - Call LLM với prompt
- `getAvailableModels()` - List models
- `switchProvider()` - Switch between providers
- `healthCheck()` - Check provider health

**Provider Support:**
- AI Studio (browser automation)
- OpenAI (API)
- Anthropic Claude (API)
- Ollama (local)

**Dependencies:** None (leaf service)

---

### 5. ToolManager.md

**Responsibility:** Execute tools và manage tool registry

**Key Interfaces:**
- `execute()` - Execute tool
- `registerTool()`, `unregisterTool()` - Manage registry
- `getTool()`, `getTools()`, `listTools()` - Query tools
- `validateParams()` - Validate tool parameters

**Built-in Tools:**
- File System: `read_file`, `write_file`, `search_files`
- Code Analysis: `search_code`, `get_diagnostics`
- Testing: `run_tests`
- Git: `git_status`

**Dependencies:** None (leaf service)

---

### 6. ContextManager.md

**Responsibility:** Quản lý shared context và state giữa steps

**Key Interfaces:**
- `get()`, `set()`, `update()`, `merge()` - Basic operations
- `getNested()`, `setNested()` - Nested access
- `subscribe()` - Watch for changes
- `snapshot()`, `restore()` - State snapshots
- Helpers: `addDiscovery()`, `addError()`, `addWarning()`

**Context Schema:**
- User request & code context
- Project context
- Execution state
- Accumulated data (discoveries, errors, warnings)
- Step outputs

**Dependencies:** None (shared service)

---

### 7. PTKManager.md

**Responsibility:** Gateway cho LLM interactions với tool calling (PTK protocol)

**Key Interfaces:**
- `execute()` - Execute prompt với tool calling loop
- `executeIteration()` - Single iteration
- `formatPrompt()` - Build prompt với tool definitions
- `parseResponse()` - Parse response để detect tool calls

**Components:**
- PTKFormatter - Build prompts
- PTKParser - Parse responses
- PTKExecutor - Orchestrate loop

**Dependencies:**
- LLM Manager (call LLM)
- Tool Manager (execute tools)
- Context Manager (store conversation history)

---

## Dependency Graph

```
┌─────────────────────────────────────────┐
│         TOP LEVEL MANAGERS              │
├─────────────────────────────────────────┤
│                                         │
│  Complexity Manager                     │
│       ↓                                 │
│  Plan Manager                           │
│       ↓                                 │
│  Execution Manager ←──────┐             │
│       │                   │             │
│       ├─────┬──────┬──────┘             │
│       ↓     ↓      ↓                    │
├───────────────────────────────────────┤ │
│         SERVICE MANAGERS              │ │
├───────────────────────────────────────┤ │
│                                       │ │
│    PTK Manager                        │ │
│       ├──────┬───────┐                │ │
│       ↓      ↓       ↓                │ │
│  ┌─────┐ ┌──────┐ ┌─────────┐        │ │
│  │ LLM │ │ Tool │ │ Context │        │ │
│  └─────┘ └──────┘ └─────────┘        │ │
│    ↑        ↑          ↑              │ │
│    │        │          │              │ │
│  Leaf Services (no dependencies)     │ │
│                                       │ │
└───────────────────────────────────────┘ │
```

---

## Data Flow Example: Complex Request

```
1. User: "Refactor authentication to use JWT"

2. Complexity Manager
   - assessComplexity() → "complex"

3. Plan Manager
   - generatePlan() → 5 steps:
     Step1: Analyze current auth (LLM)
     Step2: Find auth files (Tool: search_files)
     Step3: Generate refactored code (PTK: read_file, search_code)
     Step4: Run tests (Tool: run_tests)
     Step5: Final review (LLM)

4. Execution Manager
   - executePlan(plan)
   
   Loop:
     Step1: executeStep() → LLM Manager
     Step2: executeStep() → Tool Manager
     Step2 result: Found 10 files (unexpected!)
     
     [Dynamic Update]
     Plan Manager: insertStepAfter(Step2, "Analyze extra files")
     
     Step2.5: executeStep() → PTK Manager
       → PTK calls LLM Manager
       → PTK calls Tool Manager (read_file x 10)
       → PTK calls LLM Manager (final analysis)
     
     Step3: executeStep() → PTK Manager
     Step4: executeStep() → Tool Manager
     Step4 result: Tests FAILED
     
     [Dynamic Update]
     Plan Manager: appendStep("Fix bugs")
     Plan Manager: appendStep("Run tests again")
     
     Step6: executeStep() → PTK Manager
     Step7: executeStep() → Tool Manager
     Step7 result: Tests PASSED ✓
     
     Step5: executeStep() → LLM Manager

5. Result: ExecutionResult
   - success: true
   - iterations: 7 steps
   - planUpdates: 2 updates
```

---

## Implementation Order

### Phase 1: Foundation (Tuần 1-2)

1. **Context Manager** - Build first, cần cho tất cả managers
2. **LLM Manager** - Leaf service, AI Studio automation
3. **Tool Manager** - Leaf service, basic tools

### Phase 2: Core Services (Tuần 3-4)

4. **PTK Manager** - Cần LLM + Tool đã xong
5. **Complexity Manager** - Cần LLM
6. **Plan Manager** - Cần LLM

### Phase 3: Orchestration (Tuần 5-6)

7. **Execution Manager** - Cần tất cả managers khác

---

## Testing Strategy

### Unit Tests

Mỗi manager có unit tests riêng:

```typescript
// ComplexityManager.test.ts
describe('ComplexityManager', () => {
  test('should classify simple task', () => {});
  test('should classify complex task', () => {});
  test('should fallback to heuristic on LLM error', () => {});
});
```

### Integration Tests

Test tương tác giữa managers:

```typescript
// Integration.test.ts
describe('Manager Integration', () => {
  test('Execution Manager should use PTK Manager for PTK steps', () => {});
  test('PTK Manager should call LLM and Tool Managers', () => {});
  test('Plan Manager dynamic updates should work', () => {});
});
```

### E2E Tests

Test toàn bộ flow:

```typescript
// E2E.test.ts
describe('End-to-End Flow', () => {
  test('should handle simple refactoring request', () => {});
  test('should handle complex multi-file refactoring', () => {});
  test('should recover from errors', () => {});
});
```

---

## Notes for Developers

### Code Organization

```
src/
  core/
    managers/
      complexity/
        ComplexityManager.ts
        ComplexityManager.test.ts
        types.ts
      plan/
        PlanManager.ts
        PlanManager.test.ts
        templates/
          refactoring.ts
          bugfix.ts
        types.ts
      execution/
        ExecutionManager.ts
        ExecutionManager.test.ts
        types.ts
      ptk/
        PTKManager.ts
        PTKFormatter.ts
        PTKParser.ts
        PTKExecutor.ts
        PTKManager.test.ts
        types.ts
      llm/
        LLMManager.ts
        providers/
          AIStudioProvider.ts
          OpenAIProvider.ts
          OllamaProvider.ts
        LLMManager.test.ts
        types.ts
      tool/
        ToolManager.ts
        tools/
          filesystem.ts
          codeanalysis.ts
          testing.ts
          git.ts
        ToolManager.test.ts
        types.ts
      context/
        ContextManager.ts
        ContextManager.test.ts
        types.ts
```

### Best Practices

1. **Type Safety**: Sử dụng TypeScript strict mode
2. **Dependency Injection**: Pass dependencies qua constructor
3. **Error Handling**: Throw custom errors với context
4. **Logging**: Log quan trọng events
5. **Testing**: Aim for >80% code coverage
6. **Documentation**: JSDoc cho public APIs

---

## Next Steps

1. Review interfaces với team
2. Start implementation theo Phase 1
3. Setup CI/CD cho automated testing
4. Build VS Code extension integration
5. Create user documentation

---

## References

- `PTK_DESIGN.md` - PTK Protocol chi tiết
- `SYSTEM_ARCHITECTURE.md` - Overall architecture
- `PROJECT_IDEA.md` - Vision và goals
- `AI_AGENT_STRATEGY.md` - Strategy overview
