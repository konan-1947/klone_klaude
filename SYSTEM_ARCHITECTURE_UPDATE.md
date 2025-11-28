# SYSTEM_ARCHITECTURE.md - Updates cần thêm

## Cần thêm: ClineIgnoreController

### Lý do:
Từ Cline, **ClineIgnoreController** là component quan trọng cho security và access control. Nó KHÔNG có trong SYSTEM_ARCHITECTURE.md hiện tại nhưng là ESSENTIAL cho production.

---

## UPDATE 1: Architecture Diagram

### Current (6 Managers):
```
Complexity → Plan → Execution → [PTK, LLM, Tool, Context]
```

### Proposed (7 Managers):
```
User Request (VS Code)
    ↓
┌─────────────────────────────────────┐
│ 1. COMPLEXITY MANAGER               │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│ 2. PLAN MANAGER                     │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│ 3. EXECUTION MANAGER                │
└─────────────────────────────────────┘
    ↓
    ├──────────────┬──────────────┬─────────────┬──────────────┐
    ↓              ↓              ↓             ↓              ↓
┌────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌──────────────┐
│  PTK   │ │   LLM   │ │  TOOL   │ │ CONTEXT │ │  IGNORE      │ ⭐ NEW
│ MANAGER│ │ MANAGER │ │ MANAGER │ │ MANAGER │ │  CONTROLLER  │
│        │ │         │ │         │ │         │ │              │
│ Format │ │  Call   │ │  Exec   │ │  State  │ │ - Security   │
│ Parse  │ │  LLM    │ │  tools  │ │  store  │ │ - .ignore    │
│Loop    │ │         │ │    ↑    │ │         │ │ - Validate   │
└────────┘ └─────────┘ └────┼────┘ └─────────┘ └──────┬───────┘
                            │                         │
                            └─────────────────────────┘
                                 Tool uses Ignore
```

---

## UPDATE 2: Manager Roles - Thêm ClineIgnoreController

### Add to list:

```markdown
**Manager Roles:**
- **Complexity Manager**: Đánh giá độ phức tạp request
- **Plan Manager**: Tạo execution plan (steps)
- **Execution Manager**: Điều phối thực thi plan
- **PTK Manager**: Gateway cho tool calling
- **LLM Manager**: Gọi LLM providers
- **Tool Manager**: Execute tools (read_file, search_code, etc.)
- **Context Manager**: Quản lý state/context cho agent
- **ClineIgnore Controller**: Security - Kiểm soát file access ⭐ NEW
```

---

## UPDATE 3: Thêm Section mới - ClineIgnoreController

### Insert sau "7. Context Manager":

```markdown
### 8. ClineIgnore Controller 🔒

**Responsibilities**:
- Kiểm soát files/folders AI được phép truy cập
- Parse và enforce `.clineignore` rules
- Real-time file watcher
- Validate paths before tool execution

**Input**:
- File path to validate
- Command to validate

**Output**:
```typescript
{
  allowed: boolean
  reason?: string
}
```

**Methods**:
- `initialize()` → Load .clineignore + setup watcher
- `validateAccess(path)` → Check if file accessible
- `validateCommand(cmd)` → Check if command safe
- `filterPaths(paths)` → Filter array of paths
- `dispose()` → Cleanup watcher

**Features**:
- **Gitignore syntax**: Supports same patterns as .gitignore
- **File watcher**: Auto-reload when .clineignorechanges
- **!include directive**: Can include patterns from other files
- **Command validation**: Block dangerous commands (cat, grep on ignored files)

**Integration**:
- **Tool Manager** calls `validateAccess()` before every operation
- **list_files**, **search_files** use `filterPaths()` to exclude ignored files
- Shows 🔒 symbol next to blocked files in UI

**Security Rules**:
- Self-ignore: `.clineignore` file itself cannot be read
- Fail-safe: No file → allow all (không block gì)
- Real-time: Changes take effect immediately

**Example .clineignore**:
```bash
# Sensitive files
.env
.env.*
secrets/

# Dependencies
node_modules/
.git/

# Build outputs
dist/
*.min.js

# Include from other files
!include .gitignore
```
```

---

## UPDATE 4: Core Components Section

### Update "6. Tool Manager" to mention integration:

```markdown
### 6. Tool Manager

**Responsibilities**:
- Execute tools (read_file, run_tests, search, etc.)
- Manage tool registry
- **Validate access via ClineIgnoreController** ⭐ NEW

**Input**:
- Tool name
- Tool parameters

**Output**:
- Tool execution result

**Methods**:
- `execute(toolName, params)` → result
- `registerTool(name, handler)` → void
- `listTools()` → string[]
- **`validateToolAccess(toolName, params)`** → boolean ⭐ NEW

**Execution Flow**: ⭐ UPDATED
```
1. Validate tool parameters
2. **Check file access (via ClineIgnoreController)** ⭐ NEW
3. Execute tool handler
4. Return result
```
```

---

## UPDATE 5: Implementation Phases

### Update Phase 1: MVP

```markdown
### Phase 1: MVP (Essential)

**Managers**:
- Complexity Manager (heuristic only)
- Plan Manager (template-based)
- Execution Manager (basic)
- LLM Manager (chatbot automation)
- Tool Manager (basic tools)
- Context Manager
- **ClineIgnore Controller** ⭐ NEW

**Features**:
- Simple path (direct execution)
- Complex path (template plans)
- Basic error handling
- Inline diff
- **Security via .clineignore** ⭐ NEW
```

---

## UPDATE 6: Data Structures - Add ToolResult

### Add security info to ToolResult:

```typescript
ToolResult {
  success: boolean
  data: any
  error?: Error
  
  // Security info ⭐ NEW
  accessDenied?: boolean
  deniedPath?: string
  deniedReason?: string
}
```

---

## Summary of Changes

### Additions to SYSTEM_ARCHITECTURE.md:

1. ✅ **Diagram**: Add ClineIgnore Controller box
2. ✅ **Manager Roles**: Add 8th manager
3. ✅ **Section 8**: Full ClineIgnoreController documentation
4. ✅ **Tool Manager update**: Mention integration
5. ✅ **Phase 1 update**: Include in MVP
6. ✅ **Data structures**: Add security fields

### Why these changes?

- ✅ **Security-first**: Production systems need access control
- ✅ **Reality**: Implementation will include this from Cline
- ✅ **Complete picture**: Architecture should reflect actual system
- ✅ **Essential**: Not optional - needed for Phase 1 MVP

### Impact:

- **7 Managers total** (was 6)
- **Security built-in** from start
- **Aligns with Cline** best practices
- **Production-ready** architecture

---

## Other components NOT needed in SYSTEM_ARCHITECTURE.md:

### ❌ StateManager
- Reason: Implementation detail, not core workflow
- CookieManager + simple persistence is sufficient
- Can refactor later if needed

### ❌ WorkspaceRootManager
- Reason: Single workspace is fine for Phase 1
- Phase 2+ enhancement
- Not part of core execution flow

### ❌ DecorationController
- Reason: UI concern, not business logic
- VS Code specific implementation
- Not part of architecture design

---

## Conclusion

**CẦN UPDATE:** Chỉ cần thêm **ClineIgnoreController** vào SYSTEM_ARCHITECTURE.md

**KHÔNG CẦN:** StateManager, WorkspaceRootManager, DecorationController (implementation details)

**Priority:** Medium - Nên update để architecture complete, nhưng không blocking implementation
