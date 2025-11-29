# Thiết kế Log Panel cho Chat Interface

## Tổng quan

Thêm một panel log riêng biệt bên dưới chat để hiển thị chi tiết quá trình xử lý của AI Agent. Panel này có thể collapse/expand và hiển thị realtime log.

## Thiết kế UI

### Cấu trúc Layout

```
┌─────────────────────────────────────┐
│ Header (Status + Actions)           │
├─────────────────────────────────────┤
│                                     │
│ Chat Container                      │
│ (Messages)                          │
│                                     │
├─────────────────────────────────────┤
│ Log Panel Header                    │
│ [▼ Logs] [Clear] [Auto-scroll]      │
├─────────────────────────────────────┤
│ Log Content (Collapsible)           │
│ • [12:34:56] Đang đọc file...      │
│ • [12:34:57] Tool: read_file       │
│ • [12:34:58] Response: OK          │
├─────────────────────────────────────┤
│ Input Container                     │
└─────────────────────────────────────┘
```

### Thành phần Log Panel

1. **Log Panel Header**
   - Toggle button (expand/collapse)
   - Clear logs button
   - Auto-scroll checkbox
   - Badge hiển thị số lượng log

2. **Log Content Area**
   - Scrollable container
   - Max height: 200px
   - Mỗi log entry có:
     - Timestamp
     - Log level (info, warning, error)
     - Message
     - Icon tùy theo type

## Thiết kế Data Flow

### Message Types mới

```typescript
// Frontend → Backend
type: 'clearLogs'

// Backend → Frontend
type: 'log'
data: {
  timestamp: string,
  level: 'info' | 'warning' | 'error',
  category: string,  // 'ptk', 'tool', 'llm', 'file'
  message: string
}
```

### Log Events cần emit

1. **PTK Manager**
   - Bắt đầu orchestration
   - Parsing response
   - Tool calling detected
   - Iteration completed

2. **Tool Execution**
   - Tool được gọi (tool name + params)
   - Tool execution started
   - Tool execution finished
   - Tool result

3. **LLM Calls**
   - Sending prompt to LLM
   - Receiving response from LLM
   - Token count (nếu có)

4. **File Operations**
   - Reading file
   - Building context
   - File ignored

## Implementation Steps

### Bước 1: Cập nhật HTML và CSS

**File: `src/views/chat.html`**

Thêm vào structure:
- Log panel header với các controls
- Log content container
- CSS cho log panel
- CSS cho log entries với màu sắc theo level

### Bước 2: Cập nhật JavaScript trong chat.html

Thêm functions:
- `addLog(timestamp, level, category, message)` - Thêm log entry
- `clearLogs()` - Xóa tất cả logs
- `toggleLogPanel()` - Expand/collapse panel
- `scrollLogToBottom()` - Auto scroll log panel

Thêm event listeners:
- Toggle button click
- Clear button click
- Auto-scroll checkbox change
- Nhận message type 'log' từ backend

### Bước 3: Tạo LogEmitter class

**File: `src/core/logging/LogEmitter.ts`**

```typescript
interface LogEntry {
  timestamp: string;
  level: 'info' | 'warning' | 'error';
  category: string;
  message: string;
}

class LogEmitter {
  private listeners: Array<(log: LogEntry) => void>;
  
  emit(level, category, message): void
  on(callback): void
  off(callback): void
}
```

### Bước 4: Tích hợp LogEmitter vào ChatViewProvider

**File: `src/providers/chat/ChatViewProvider.ts`**

- Tạo instance LogEmitter
- Subscribe vào LogEmitter
- Forward logs tới webview qua postMessage
- Pass LogEmitter xuống PTKManager

### Bước 5: Emit logs từ PTKManager

**Files cần update:**
- `src/core/ptk/StandardPTKManager.ts`
- `src/core/ptk/OptimizedPTKManager.ts`

Thêm log emissions tại các điểm:
- Bắt đầu orchestration
- Parse response
- Detect tool call
- Execute tool
- Iteration complete
- Final result

### Bước 6: Emit logs từ Tool Executors

**File: `src/core/tools/ToolExecutor.ts`**

Emit logs:
- Tool execution start
- Tool execution end  
- Tool errors

### Bước 7: Emit logs từ LLM Providers

**Files:**
- `src/core/llm/AIStudioLLMProvider.ts`
- `src/core/llm/GeminiLLMProvider.ts`

Emit logs:
- Sending prompt
- Receiving response
- API errors

### Bước 8: Testing

Test các scenarios:
- Log panel collapse/expand
- Clear logs
- Auto-scroll on/off
- Logs hiển thị đúng thứ tự
- Logs có màu sắc đúng theo level
- Performance với nhiều logs

## Chi tiết Style

### Log Entry Colors (theo level)

```css
.log-info    { color: #808080; } /* Gray */
.log-warning { color: #FFA500; } /* Orange */
.log-error   { color: #FF4444; } /* Red */
```

### Log Categories Icons

- `ptk`: ⚙️ (gear)
- `tool`: 🔧 (wrench)
- `llm`: 🤖 (robot)
- `file`: 📄 (file)

### Panel States

```css
.log-panel.collapsed { max-height: 0; }
.log-panel.expanded  { max-height: 200px; }
```

## Log Message Format

```
[HH:MM:SS] [CATEGORY] Message text
```

Example:
```
[23:45:30] [PTK] Bắt đầu orchestration
[23:45:31] [LLM] Sending prompt to AI Studio (150 tokens)
[23:45:33] [PTK] Detected tool call: read_file
[23:45:33] [TOOL] Executing read_file(path="/src/index.ts")
[23:45:34] [TOOL] Tool completed (150 bytes read)
[23:45:35] [LLM] Receiving response from AI Studio
[23:45:35] [PTK] Iteration 1 completed
```

## Notes

- Log panel không ảnh hưởng đến chat chính
- Logs được giữ trong session, clear khi logout
- Max logs trong memory: 500 entries (auto trim oldest)
- Log panel default state: collapsed
- Auto-scroll default: enabled
