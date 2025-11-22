# PTK (Protokol) Design Document

**PTK** = **P**rompt-based **T**ool **K**alling Protocol

Text-based protocol cho LLM tool calling khi không có native function calling API.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    PTK LAYER                            │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌──────────────┐      ┌──────────────┐                 │
│  │ PTKFormatter │      │  PTKParser   │                 │
│  │              │      │              │                 │
│  │ - System     │      │ - Detect     │                 │
│  │   Prompt     │      │   Tool Calls │                 │
│  │ - Tool Defs  │      │ - Validate   │                 │
│  └──────────────┘      └──────────────┘                 │
│         ↓                      ↑                        │
│         └──────────┬───────────┘                        │
│                    ↓                                    │
│         ┌──────────────────────┐                        │
│         │   PTKExecutor        │                        │
│         │                      │                        │
│         │ - Orchestrate loop   │                        │
│         │ - Handle retries     │                        │
│         │ - Manage context     │                        │
│         └──────────────────────┘                        │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## Components Explained

PTK protocol bao gồm 3 components chính, mỗi component có vai trò riêng biệt:

### PTKFormatter - "Người Dạy"

**Vai trò:** Dạy LLM cách sử dụng tools

**Làm gì:**
- Tạo system prompt với instructions về PTK protocol
- Format danh sách tools thành text dễ hiểu cho LLM
- Format conversation history (user → assistant → tool → assistant)
- Format kết quả tool execution để gửi lại cho LLM

**Ví dụ Output:**
```
You are an AI assistant with access to these tools:

• read_file: Read content of a file
Parameters:
  - path: string (required) - File path

PROTOCOL: PTK (Protokol - Prompt-based Tool Kalling)
When you need to use a tool, respond with EXACTLY this format:
<PTK_CALL>
{
  "tool": "read_file",
  "args": {"path": "test.ts"}
}
</PTK_CALL>
```

**Analogy:** Như một giáo viên dạy học sinh (LLM) cách điền form đúng format.

---

### PTKParser - "Người Hiểu"

**Vai trò:** Đọc và hiểu response từ LLM

**Làm gì:**
- Phát hiện `<PTK_CALL>` tags trong text response
- Extract tool name và arguments từ JSON
- Validate format (tool name có đúng? args có đủ?)
- Xử lý nhiều format variations (case-insensitive, typos, etc.)

**Ví dụ Input → Output:**
```typescript
// Input từ LLM
"I'll read that file. <PTK_CALL>{"tool":"read_file","args":{"path":"x.ts"}}</PTK_CALL>"

// Output sau parse
{
  type: 'tool_call',
  toolCall: {
    tool: 'read_file',
    args: { path: 'x.ts' }
  }
}
```

**Analogy:** Như một người đọc form đã điền, check xem có sai sót gì không.

---

### PTKExecutor - "Người Điều Phối"

**Vai trò:** Điều phối toàn bộ flow tool calling

**Làm gì:**
- Quản lý loop: LLM → Parse → Tool → LLM → Parse → ...
- Track conversation history (context cho mỗi iteration)
- Execute tools khi parser phát hiện tool call
- Handle errors và retries
- Stop khi LLM trả về final answer hoặc max iterations

**Flow:**
```
1. User: "Read package.json"
2. Executor → Format prompt với tool defs
3. Executor → Call LLM
4. LLM responds: "<PTK_CALL>...</PTK_CALL>"
5. Executor → Parser detects tool call
6. Executor → Execute read_file tool
7. Executor → Format result: "PTK_RESULT: {...}"
8. Executor → Call LLM again với result
9. LLM responds: "The version is 1.0.0"
10. Executor → Parser detects text response
11. Executor → DONE, return to user
```

**Analogy:** Như một project manager điều phối giữa giáo viên (Formatter), học sinh (LLM), người chấm bài (Parser), và người thực thi (Tool).

---

### Tóm Tắt Quan Hệ

```
PTKFormatter
    ↓ (formatted prompt)
LLM
    ↓ (raw response)
PTKParser
    ↓ (parsed: tool_call or text)
PTKExecutor
    ↓ (orchestrates)
    ├─ If tool_call → Execute tool → Loop back
    └─ If text → Done, return result
```

**Key Insight:** 
- **Formatter** = INPUT preparation
- **Parser** = OUTPUT understanding
- **Executor** = FLOW orchestration

---

## PTK Manager trong Overall Architecture

PTK Manager là **peer service** cùng level với LLM Manager và Tool Manager trong Manager Layer.

### Position trong Architecture

```
┌─────────────────────────────────────────────────────┐
│            MANAGER LAYER (7 Managers)               │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Complexity Manager → Plan Manager → Execution Mgr │
│                                            │        │
│         ┌──────────────────────────────────┼────┐  │
│         ↓                ↓                 ↓    ↓  │
│   ┌──────────┐    ┌──────────┐    ┌──────────┐    │
│   │   PTK    │    │   LLM    │    │   Tool   │    │
│   │ Manager  │    │ Manager  │    │ Manager  │    │
│   └──────────┘    └──────────┘    └──────────┘    │
│         │               ↑               ↑          │
│         └───────────────┴───────────────┘          │
│            PTK uses LLM & Tool                     │
│                    ↓                                │
│            Context Manager                         │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### PTK Manager Role

**PTK Manager = Gateway cho mọi LLM interactions**

Khi Execution Manager cần:
- **Simple LLM call (no tools)**: Gọi PTK Manager với `tools: []`
- **LLM with tools**: Gọi PTK Manager với `tools: [...]`
- **Direct tool call**: Gọi trực tiếp Tool Manager (bypass PTK)

### Relationships

#### **1. PTK Manager USES LLM Manager**

```typescript
class PTKExecutor {
  constructor(private llmManager: LLMManager) {}
  
  async execute(prompt: string, tools: Tool[]): Promise<string> {
    // PTK calls LLM Manager (không phải ngược lại)
    const response = await this.llmManager.call(formattedPrompt);
    // ...
  }
}
```

**Direction**: PTK → LLM (dependency)

---

#### **2. PTK Manager USES Tool Manager**

```typescript
class PTKExecutor {
  constructor(
    private llmManager: LLMManager,
    private toolManager: ToolManager  // ← dependency
  ) {}
  
  async execute(prompt: string, tools: Tool[]): Promise<string> {
    // ...
    if (parsed.type === 'tool_call') {
      // PTK calls Tool Manager
      const result = await this.toolManager.execute(
        parsed.toolCall.tool,
        parsed.toolCall.args
      );
    }
  }
}
```

**Direction**: PTK → Tool (dependency)

---

#### **3. PTK Manager USES Context Manager**

```typescript
class PTKExecutor {
  constructor(
    private llmManager: LLMManager,
    private toolManager: ToolManager,
    private contextManager: ContextManager  // ← dependency
  ) {}
  
  async execute(prompt: string, tools: Tool[]): Promise<string> {
    // Read conversation history
    const history = this.contextManager.get('ptkHistory') || [];
    
    // ... execute tool calling loop
    
    // Write updated history
    this.contextManager.set('ptkHistory', updatedHistory);
  }
}
```

**Direction**: PTK ↔ Context (read/write)

---

### Why PTK is NOT Inside LLM Manager

**Separation of Concerns:**

| Manager | Responsibility | Scope |
|---------|---------------|-------|
| **LLM Manager** | Gọi LLM providers | Single LLM call |
| **PTK Manager** | Tool calling orchestration | Multiple LLM calls + tools |
| **Tool Manager** | Execute tools | Tool execution |

**Dependencies:**
```
PTK Manager needs:
  ├─ LLM Manager (to call LLM)
  └─ Tool Manager (to execute tools)

If PTK inside LLM Manager:
  LLM Manager needs Tool Manager → ❌ Circular dependency risk
```

**Conclusion:** PTK phải là independent service để tránh circular dependencies.

---

## Core Interfaces

### 1. IPTKFormatter

Responsible for formatting prompts with tool definitions.

```typescript
/**
 * Formatter for PTK protocol
 * Creates prompts with tool definitions and instructions
 */
export interface IPTKFormatter {
  /**
   * Format system prompt bao gồm định nghĩa các tool
   */
  formatSystemPrompt(tools: PTKTool[]): string;

  /**
   * Format định nghĩa tool để hiển thị
   */
  formatToolDefinitions(tools: PTKTool[]): string;

  /**
   * Format lịch sử hội thoại để làm context
   */
  formatConversation(history: PTKMessage[]): string;

  /**
   * Format kết quả thực thi tool để gửi lại cho LLM
   */
  formatToolResult(result: PTKToolResult): string;
}
```

**Implementation:**
```typescript
// src/core/ptk/PTKFormatter.ts
export class PTKFormatter implements IPTKFormatter {
  formatSystemPrompt(tools: PTKTool[]): string {
    const toolDefs = this.formatToolDefinitions(tools);
    
    return `You are an AI assistant with access to these tools:

${toolDefs}

PROTOCOL: PTK (Protokol - Prompt-based Tool Kalling)
When you need to use a tool, respond with EXACTLY this format:

<PTK_CALL>
{
  "tool": "tool_name",
  "args": {"param": "value"},
  "reasoning": "why you need this"
}
</PTK_CALL>

RULES:
1. ONE tool call per response
2. Valid JSON only
3. Use exact tool names
4. Include all required parameters
5. After TOOL_RESULT, continue or provide final answer

When done, respond normally without tags.`;
  }

  formatToolDefinitions(tools: PTKTool[]): string {
    return tools.map(tool => {
      const params = Object.entries(tool.parameters.properties)
        .map(([name, def]: [string, any]) => {
          const required = tool.parameters.required?.includes(name) ? '(required)' : '(optional)';
          return `  - ${name}: ${def.type} ${required} - ${def.description}`;
        })
        .join('\n');

      return `• ${tool.name}: ${tool.description}
Parameters:
${params}`;
    }).join('\n\n');
  }

  formatConversation(history: PTKMessage[]): string {
    return history.map(msg => {
      switch (msg.role) {
        case 'system':
          return msg.content;
        case 'user':
          return `USER: ${msg.content}`;
        case 'assistant':
          return `ASSISTANT: ${msg.content}`;
        case 'tool':
          return msg.content; // Already formatted
        default:
          return '';
      }
    }).join('\n\n');
  }

  formatToolResult(result: PTKToolResult): string {
    if (result.success) {
      return `PTK_RESULT: ${JSON.stringify(result.data)}`;
    } else {
      return `PTK_ERROR: ${result.error}`;
    }
  }
}
```

---

### 2. IPTKParser

Responsible for parsing LLM responses and extracting tool calls.

```typescript
/**
 * Parser for PTK protocol
 * Detects and extracts tool calls from text responses
 */
export interface IPTKParser {
  /**
   * Parse LLM response
   * Returns tool call if detected, otherwise text response
   */
  parse(response: string): PTKResponse;

  /**
   * Validate tool call structure
   */
  validate(toolCall: PTKToolCall): PTKValidation;

  /**
   * Extract tool call from text (multiple pattern support)
   */
  extract(response: string): PTKToolCall | null;
}
```

**Implementation:**
```typescript
// src/core/ptk/PTKParser.ts
export class PTKParser implements IPTKParser {
  private patterns = [
    /<PTK_CALL>\s*([\s\S]*?)\s*<\/PTK_CALL>/i,      // Standard
    /<ptk_call>\s*([\s\S]*?)\s*<\/ptk_call>/i,      // Lowercase
    /<TOOL_CALL>\s*([\s\S]*?)\s*<\/TOOL_CALL>/i,    // Legacy compat
  ];

  parse(response: string): PTKResponse {
    const toolCall = this.extract(response);
    
    if (!toolCall) {
      return {
        type: 'text',
        content: response.trim(),
        raw: response
      };
    }

    return {
      type: 'tool_call',
      toolCall,
      raw: response
    };
  }

  extract(response: string): PTKToolCall | null {
    for (const pattern of this.patterns) {
      const match = response.match(pattern);
      if (match) {
        try {
          const cleaned = this.cleanJSON(match[1]);
          const parsed = JSON.parse(cleaned);
          
          return {
            tool: parsed.tool,
            args: parsed.args || {},
            reasoning: parsed.reasoning
          };
        } catch (e) {
          console.warn('Failed to parse PTK call:', e);
          continue; // Try next pattern
        }
      }
    }
    
    return null;
  }

  validate(toolCall: PTKToolCall): PTKValidation {
    if (!toolCall.tool || typeof toolCall.tool !== 'string') {
      return {
        valid: false,
        error: 'Missing or invalid tool name'
      };
    }

    if (!toolCall.args || typeof toolCall.args !== 'object') {
      return {
        valid: false,
        error: 'Missing or invalid args'
      };
    }

    return { valid: true };
  }

  private cleanJSON(json: string): string {
    return json
      .replace(/\/\/.*$/gm, '')        // Remove comments
      .replace(/,(\s*[}\]])/g, '$1')   // Remove trailing commas
      .replace(/'/g, '"')               // Fix quotes
      .trim();
  }
}
```

---

### 3. IPTKExecutor

Responsible for executing tool calls and managing the loop.

```typescript
/**
 * Executor for PTK protocol
 * Orchestrates the tool calling loop
 */
export interface IPTKExecutor {
  /**
   * Execute a prompt with PTK support
   * Handles multiple tool calls automatically
   */
  execute(
    prompt: string,
    options?: PTKExecuteOptions
  ): Promise<PTKExecuteResult>;

  /**
   * Execute single iteration
   */
  executeIteration(
    messages: PTKMessage[],
    options: PTKExecuteOptions
  ): Promise<PTKIterationResult>;

  /**
   * Handle tool execution
   */
  executeTool(
    toolCall: PTKToolCall,
    tools: Map<string, PTKTool>
  ): Promise<PTKToolResult>;
}
```

**Implementation:**
```typescript
// src/core/ptk/PTKExecutor.ts
export class PTKExecutor implements IPTKExecutor {
  constructor(
    private llmProvider: ILLMProvider,
    private formatter: IPTKFormatter,
    private parser: IPTKParser
  ) {}

  async execute(
    prompt: string,
    options: PTKExecuteOptions = {}
  ): Promise<PTKExecuteResult> {
    const {
      tools = [],
      maxIterations = 5,
      onIteration,
      onToolCall,
      onError
    } = options;

    const toolMap = new Map(tools.map(t => [t.name, t]));
    const messages: PTKMessage[] = [];

    // Add system prompt
    const systemPrompt = this.formatter.formatSystemPrompt(tools);
    messages.push({ role: 'system', content: systemPrompt });

    // Add user prompt
    messages.push({ role: 'user', content: prompt });

    let iteration = 0;

    while (iteration < maxIterations) {
      iteration++;

      try {
        // Execute iteration
        const result = await this.executeIteration(messages, {
          tools,
          toolMap,
          iteration
        });

        onIteration?.({
          iteration,
          type: result.type,
          content: result.content
        });

        if (result.type === 'text') {
          // Done - final answer
          return {
            success: true,
            content: result.content,
            iterations: iteration,
            messages
          };
        }

        if (result.type === 'tool_call') {
          // Execute tool
          onToolCall?.(result.toolCall!);

          const toolResult = await this.executeTool(
            result.toolCall!,
            toolMap
          );

          // Add to conversation
          messages.push({
            role: 'assistant',
            content: result.raw
          });

          messages.push({
            role: 'tool',
            content: this.formatter.formatToolResult(toolResult)
          });

          // Continue loop
        }

      } catch (error) {
        onError?.(error as Error);
        
        return {
          success: false,
          error: (error as Error).message,
          iterations: iteration,
          messages
        };
      }
    }

    // Max iterations reached
    return {
      success: false,
      error: 'Max iterations reached',
      iterations: iteration,
      messages
    };
  }

  async executeIteration(
    messages: PTKMessage[],
    options: any
  ): Promise<PTKIterationResult> {
    // Format full prompt
    const fullPrompt = this.formatter.formatConversation(messages);

    // Call LLM
    const response = await this.llmProvider.call(fullPrompt);

    // Parse response
    const parsed = this.parser.parse(response);

    if (parsed.type === 'tool_call') {
      // Validate
      const validation = this.parser.validate(parsed.toolCall!);
      if (!validation.valid) {
        throw new Error(`Invalid tool call: ${validation.error}`);
      }

      // Check tool exists
      if (!options.toolMap.has(parsed.toolCall!.tool)) {
        throw new Error(`Unknown tool: ${parsed.toolCall!.tool}`);
      }
    }

    return {
      type: parsed.type,
      content: parsed.type === 'text' ? parsed.content : undefined,
      toolCall: parsed.type === 'tool_call' ? parsed.toolCall : undefined,
      raw: parsed.raw
    };
  }

  async executeTool(
    toolCall: PTKToolCall,
    tools: Map<string, PTKTool>
  ): Promise<PTKToolResult> {
    const tool = tools.get(toolCall.tool);
    if (!tool) {
      return {
        success: false,
        data: null,
        error: `Tool not found: ${toolCall.tool}`
      };
    }

    try {
      const result = await tool.handler(toolCall.args);
      return {
        success: true,
        data: result,
        error: null
      };
    } catch (error) {
      return {
        success: false,
        data: null,
        error: (error as Error).message
      };
    }
  }
}
```

---

## Type Definitions

```typescript
// src/core/ptk/types.ts

/**
 * PTK Tool definition
 */
export interface PTKTool {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, PTKParameter>;
    required?: string[];
  };
  handler: (args: any) => Promise<any>;
}

export interface PTKParameter {
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description: string;
  enum?: string[];
  default?: any;
}

/**
 * PTK Messages
 */
export interface PTKMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
}

/**
 * PTK Tool Call
 */
export interface PTKToolCall {
  tool: string;
  args: Record<string, any>;
  reasoning?: string;
}

/**
 * PTK Response
 */
export interface PTKResponse {
  type: 'text' | 'tool_call';
  content?: string;
  toolCall?: PTKToolCall;
  raw: string;
}

/**
 * PTK Tool Result
 */
export interface PTKToolResult {
  success: boolean;
  data: any;
  error: string | null;
}

/**
 * PTK Validation
 */
export interface PTKValidation {
  valid: boolean;
  error?: string;
}

/**
 * PTK Execute Options
 */
export interface PTKExecuteOptions {
  tools?: PTKTool[];
  maxIterations?: number;
  onIteration?: (info: IterationInfo) => void;
  onToolCall?: (toolCall: PTKToolCall) => void;
  onError?: (error: Error) => void;
}

export interface IterationInfo {
  iteration: number;
  type: 'text' | 'tool_call';
  content?: string;
}

/**
 * PTK Execute Result
 */
export interface PTKExecuteResult {
  success: boolean;
  content?: string;
  error?: string;
  iterations: number;
  messages: PTKMessage[];
}

export interface PTKIterationResult {
  type: 'text' | 'tool_call';
  content?: string;
  toolCall?: PTKToolCall;
  raw: string;
}

/**
 * LLM Provider interface
 */
export interface ILLMProvider {
  call(prompt: string): Promise<string>;
}
```

---

## Component Structure

```
src/core/ptk/
├── types.ts                 # Type definitions
├── interfaces/
│   ├── IPTKFormatter.ts     # Formatter interface
│   ├── IPTKParser.ts        # Parser interface
│   └── IPTKExecutor.ts      # Executor interface
├── implementations/
│   ├── PTKFormatter.ts      # Default formatter
│   ├── PTKParser.ts         # Default parser
│   └── PTKExecutor.ts       # Default executor
├── PTKManager.ts            # Facade/main entry point
└── index.ts                 # Exports
```

---

## PTKManager - Facade Pattern

```typescript
// src/core/ptk/PTKManager.ts

/**
 * PTK Manager - Main entry point
 * Facade pattern for easy usage
 */
export class PTKManager {
  private formatter: IPTKFormatter;
  private parser: IPTKParser;
  private executor: IPTKExecutor;
  private tools: Map<string, PTKTool> = new Map();

  constructor(llmProvider: ILLMProvider) {
    this.formatter = new PTKFormatter();
    this.parser = new PTKParser();
    this.executor = new PTKExecutor(
      llmProvider,
      this.formatter,
      this.parser
    );
  }

  /**
   * Register a tool
   */
  registerTool(tool: PTKTool): void {
    this.tools.set(tool.name, tool);
  }

  /**
   * Register multiple tools
   */
  registerTools(tools: PTKTool[]): void {
    tools.forEach(tool => this.registerTool(tool));
  }

  /**
   * Execute with PTK
   */
  async execute(
    prompt: string,
    options?: Omit<PTKExecuteOptions, 'tools'>
  ): Promise<PTKExecuteResult> {
    return this.executor.execute(prompt, {
      ...options,
      tools: Array.from(this.tools.values())
    });
  }

  /**
   * Get registered tools
   */
  getTools(): PTKTool[] {
    return Array.from(this.tools.values());
  }

  /**
   * Get formatter (for custom usage)
   */
  getFormatter(): IPTKFormatter {
    return this.formatter;
  }

  /**
   * Get parser (for custom usage)
   */
  getParser(): IPTKParser {
    return this.parser;
  }
}
```

---

## Usage Example

```typescript
// src/extension.ts
import { PTKManager } from './core/ptk';
import { AIStudioBrowser } from './core/browser/AIStudioBrowser';

async function setupPTK(context: vscode.ExtensionContext) {
  // 1. Setup LLM provider
  const aiStudio = new AIStudioBrowser(cookieManager, context);
  await aiStudio.initialize();

  // 2. Create PTK Manager
  const ptk = new PTKManager(aiStudio);

  // 3. Register tools
  ptk.registerTools([
    {
      name: 'read_file',
      description: 'Read content of a file',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'File path'
          }
        },
        required: ['path']
      },
      handler: async (args) => {
        const content = await fs.promises.readFile(args.path, 'utf-8');
        return { content, lines: content.split('\n').length };
      }
    },
    // More tools...
  ]);

  // 4. Use PTK
  const result = await ptk.execute(
    'Read package.json and tell me the version',
    {
      maxIterations: 5,
      onIteration: (info) => {
        console.log(`Iteration ${info.iteration}: ${info.type}`);
      },
      onToolCall: (call) => {
        console.log(`Calling tool: ${call.tool}`);
      }
    }
  );

  if (result.success) {
    vscode.window.showInformationMessage(result.content!);
  } else {
    vscode.window.showErrorMessage(result.error!);
  }
}
```

---

## Extension Points

### Custom Formatter

```typescript
class CustomPTKFormatter extends PTKFormatter {
  formatSystemPrompt(tools: PTKTool[]): string {
    // Custom format for specific LLM
    return `Custom instructions for my LLM...`;
  }
}

const ptk = new PTKManager(llmProvider);
ptk.formatter = new CustomPTKFormatter(); // Override
```

### Custom Parser

```typescript
class CustomPTKParser extends PTKParser {
  extract(response: string): PTKToolCall | null {
    // Support additional formats
    // e.g., YAML, custom tags, etc.
  }
}
```

### Middleware

```typescript
class PTKExecutorWithLogging extends PTKExecutor {
  async executeTool(toolCall, tools): Promise<PTKToolResult> {
    console.log(`[PTK] Executing: ${toolCall.tool}`);
    const start = Date.now();
    
    const result = await super.executeTool(toolCall, tools);
    
    console.log(`[PTK] Done in ${Date.now() - start}ms`);
    return result;
  }
}
```

---

## Testing Strategy

### Unit Tests

```typescript
// ptk/PTKParser.test.ts
describe('PTKParser', () => {
  const parser = new PTKParser();

  it('should parse valid tool call', () => {
    const response = '<PTK_CALL>{"tool":"read_file","args":{"path":"x"}}</PTK_CALL>';
    const result = parser.parse(response);
    
    expect(result.type).toBe('tool_call');
    expect(result.toolCall?.tool).toBe('read_file');
  });

  it('should handle text response', () => {
    const response = 'Just a normal response';
    const result = parser.parse(response);
    
    expect(result.type).toBe('text');
    expect(result.content).toBe('Just a normal response');
  });
});
```

### Integration Tests

```typescript
// ptk/PTKExecutor.test.ts
describe('PTKExecutor', () => {
  it('should execute tool and continue', async () => {
    const mockLLM = {
      call: jest.fn()
        .mockResolvedValueOnce('<PTK_CALL>{"tool":"read_file"}</PTK_CALL>')
        .mockResolvedValueOnce('The file contains version 1.0.0')
    };

    const executor = new PTKExecutor(mockLLM, formatter, parser);
    
    const result = await executor.execute('Read package.json', {
      tools: [readFileTool]
    });

    expect(result.success).toBe(true);
    expect(result.iterations).toBe(2);
  });
});
```

---

## Migration from Existing Code

### Step 1: Extract Current Logic

```typescript
// Before (in LLMManager)
async call(prompt: string) {
  const response = await this.aiStudio.sendPrompt(prompt);
  if (response.includes('<TOOL_CALL>')) {
    // Parse and execute
  }
  return response;
}
```

### Step 2: Use PTK

```typescript
// After
async call(prompt: string) {
  return this.ptkManager.execute(prompt);
}
```

---

## Performance Optimizations

### 1. Response Caching

```typescript
class CachedPTKExecutor extends PTKExecutor {
  private cache = new Map<string, PTKToolResult>();

  async executeTool(toolCall, tools): Promise<PTKToolResult> {
    const key = `${toolCall.tool}:${JSON.stringify(toolCall.args)}`;
    
    if (this.cache.has(key)) {
      return this.cache.get(key)!;
    }

    const result = await super.executeTool(toolCall, tools);
    this.cache.set(key, result);
    return result;
  }
}
```

### 2. Parallel Tool Calls (Future)

```typescript
// Support multiple tools in one response
<PTK_BATCH>
[
  {"tool":"read_file","args":{"path":"a.ts"}},
  {"tool":"read_file","args":{"path":"b.ts"}}
]
</PTK_BATCH>
```

---

## Summary

**PTK (Protokol)** provides:

1. ✅ **Clear Interfaces**: IPTKFormatter, IPTKParser, IPTKExecutor
2. ✅ **Separation of Concerns**: Each component has single responsibility
3. ✅ **Easy Extension**: Custom implementations welcome
4. ✅ **Type Safety**: Full TypeScript support
5. ✅ **Testability**: Each component independently testable
6. ✅ **Simple API**: PTKManager facade for easy usage

**Next Steps:**
1. Implement core components
2. Add comprehensive tests
3. Create tool library (file-tools, search-tools, etc.)
4. Build VS Code integration
5. Performance optimization
