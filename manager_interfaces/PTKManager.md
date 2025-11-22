# PTK Manager Interface

## Overview

PTK Manager là gateway cho mọi LLM interactions có tool calling. Nó chịu trách nhiệm orchestrate tool calling loop giữa LLM và Tools sử dụng PTK (Prompt-based Tool Kalling) protocol.

**Note:** PTK Manager chi tiết đã được design trong file `PTK_DESIGN.md`. Document này tóm tắt interface và integration với managers khác.

---

## Interface Definition

```typescript
interface IPTKManager {
  /**
   * Orchestrate tool calling loop
   * PTK Manager KHÔNG execute LLM - nó delegate cho LLM Manager
   * PTK Manager chỉ orchestrate: format → call LLM Manager → parse → call Tool Manager → loop
   * 
   * @param prompt - User prompt
   * @param options - PTK options
   * @returns Final response after tool calling loop completes
   */
  orchestrateToolCalling(
    prompt: string,
    options?: PTKExecuteOptions
  ): Promise<PTKExecuteResult>;

  /**
   * Format prompt với tool definitions
   * Prepare prompt cho LLM Manager
   */
  formatPrompt(
    prompt: string,
    tools: PTKTool[],
    history?: PTKMessage[]
  ): string;

  /**
   * Parse LLM response để detect tool calls
   * Parse response từ LLM Manager
   */
  parseResponse(response: string): PTKResponse;
}
```

**Clarification:**
- PTK Manager **KHÔNG** execute LLM calls
- PTK Manager **orchestrate** tool calling loop:
  1. Format prompt (PTKFormatter)
  2. **Delegate** to LLM Manager để call LLM
  3. Parse response (PTKParser)
  4. Nếu tool call → **Delegate** to Tool Manager
  5. Loop lại từ step 1

**Responsibility:**
- **LLM Manager**: Execute LLM calls (AI Studio, OpenAI, etc.)
- **Tool Manager**: Execute tools (read_file, run_tests, etc.)
- **PTK Manager**: Orchestrate loop giữa LLM và Tools

---

## Type Definitions

Xem chi tiết trong `PTK_DESIGN.md`, tóm tắt:

### PTKExecuteOptions

```typescript
interface PTKExecuteOptions {
  // Tools available
  tools?: PTKTool[];
  
  // Execution limits
  maxIterations?: number; // Default: 10 (max LLM calls)
  maxToolCalls?: number;  // Default: 20 (max tool executions)
  timeout?: number; // milliseconds
  
  // Callbacks
  onIteration?: (info: IterationInfo) => void;
  onToolCall?: (toolCall: PTKToolCall) => void;
  onError?: (error: Error) => void;
  onDuplicateDetected?: (toolCall: PTKToolCall) => void;
  
  // LLM config
  model?: string;
  temperature?: number;
  
  // Safety options
  detectDuplicates?: boolean; // Default: true - Detect same tool call multiple times
  duplicateWindow?: number;   // Default: 3 - Check last N tool calls
}
```

### PTKExecuteResult

```typescript
interface PTKExecuteResult {
  // Status
  success: boolean;
  
  // Output
  content: string; // Final answer
  
  // Execution info
  iterations: number;
  messages: PTKMessage[];
  toolCalls: PTKToolCall[];
  totalToolCalls: number;  // Total số lần gọi tool (để track limit)
  
  // Error (if failed)
  error?: string;
  
  // Metadata
  totalTokens?: number;
  totalCost?: number;
  duration: number; // milliseconds
}
```

### PTKTool

```typescript
interface PTKTool {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, PTKParameter>;
    required?: string[];
  };
  handler: (args: any) => Promise<any>;
}
```

### PTKResponse

```typescript
interface PTKResponse {
  type: 'text' | 'tool_call';
  content?: string; // If type='text'
  toolCall?: PTKToolCall; // If type='tool_call'
  raw: string; // Original response
}
```

### PTKToolCall

```typescript
interface PTKToolCall {
  tool: string; // Tool name
  args: Record<string, any>;
  reasoning?: string;
}
```

---

## Components

PTK Manager bao gồm 3 components (xem `PTK_DESIGN.md` cho chi tiết):

### 1. PTKFormatter

```typescript
class PTKFormatter implements IPTKFormatter {
  formatSystemPrompt(tools: PTKTool[]): string;
  formatToolDefinitions(tools: PTKTool[]): string;
  formatConversation(history: PTKMessage[]): string;
  formatToolResult(result: PTKToolResult): string;
}
```

**Responsibilities:**
- Build system prompt với tool definitions
- Format conversation history
- Format tool results

### 2. PTKParser

```typescript
class PTKParser implements IPTKParser {
  parse(response: string): PTKResponse;
  extract(response: string): PTKToolCall | null;
  validate(toolCall: PTKToolCall): PTKValidation;
}
```

**Responsibilities:**
- Detect `<PTK_CALL>` tags trong response
- Extract tool name và args
- Validate format

### 3. PTKExecutor

```typescript
class PTKExecutor implements IPTKExecutor {
  execute(prompt: string, options?: PTKExecuteOptions): Promise<PTKExecuteResult>;
  executeIteration(messages: PTKMessage[], options: any): Promise<PTKIterationResult>;
  executeTool(toolCall: PTKToolCall, tools: Map<string, PTKTool>): Promise<PTKToolResult>;
}
```

**Responsibilities:**
- Orchestrate tool calling loop
- Manage conversation history
- Handle errors và retries

---

## PTK Manager Implementation

```typescript
class PTKManager implements IPTKManager {
  private formatter: PTKFormatter;
  private parser: PTKParser;
  
  constructor(
    private llmManager: ILLMManager,      // Delegate LLM calls to this
    private toolManager: IToolManager,    // Delegate tool execution to this
    private contextManager: IContextManager
  ) {
    this.formatter = new PTKFormatter();
    this.parser = new PTKParser();
  }
  
  /**
   * Main orchestration method
   * Orchestrate tool calling loop - KHÔNG execute LLM trực tiếp
   */
  async orchestrateToolCalling(
    prompt: string,
    options: PTKExecuteOptions = {}
  ): Promise<PTKExecuteResult> {
    const {
      tools = [],
      maxIterations = 10,
      maxToolCalls = 20,  // Giới hạn 20 tool calls
      detectDuplicates = true,
      duplicateWindow = 3,
      onIteration,
      onToolCall,
      onError,
      onDuplicateDetected
    } = options;

    const toolMap = new Map(tools.map(t => [t.name, t]));
    const messages: PTKMessage[] = [];
    const toolCalls: PTKToolCall[] = [];

    // Build system prompt với tool definitions
    const systemPrompt = this.formatter.formatSystemPrompt(tools);
    messages.push({ role: 'system', content: systemPrompt });
    messages.push({ role: 'user', content: prompt });

    let iteration = 0;
    let toolCallCount = 0;  // Track total tool calls
    const startTime = Date.now();

    while (iteration < maxIterations) {
      iteration++;

      try {
        // Format conversation cho LLM
        const fullPrompt = this.formatter.formatConversation(messages);

        // DELEGATE to LLM Manager - PTK KHÔNG execute LLM
        const llmResponse = await this.llmManager.call(fullPrompt, {
          model: options.model,
          temperature: options.temperature
        });

        // Parse response từ LLM
        const parsed = this.parser.parse(llmResponse);

        onIteration?.({
          iteration,
          type: parsed.type,
          content: parsed.type === 'text' ? parsed.content : undefined,
          toolCallsSoFar: toolCallCount
        });

        if (parsed.type === 'text') {
          // Done - final answer from LLM
          return {
            success: true,
            content: parsed.content!,
            iterations: iteration,
            messages,
            toolCalls,
            totalToolCalls: toolCallCount,
            duration: Date.now() - startTime
          };
        }

        if (parsed.type === 'tool_call') {
          // Check tool call limit TRƯỚC khi execute
          if (toolCallCount >= maxToolCalls) {
            throw new PTKExecutionError(
              `Max tool calls limit reached (${maxToolCalls}). Possible infinite loop.`,
              PTKErrorCode.MAX_TOOL_CALLS_REACHED,
              { toolCalls, iteration }
            );
          }

          // Validate tool call
          const validation = this.parser.validate(parsed.toolCall!);
          if (!validation.valid) {
            throw new PTKExecutionError(
              `Invalid tool call: ${validation.error}`,
              PTKErrorCode.INVALID_TOOL_CALL
            );
          }

          // Check tool exists
          if (!toolMap.has(parsed.toolCall!.tool)) {
            throw new PTKExecutionError(
              `Tool not found: ${parsed.toolCall!.tool}`,
              PTKErrorCode.TOOL_NOT_FOUND
            );
          }

          // DUPLICATE DETECTION: Check if LLM đang loop
          if (detectDuplicates && this.isDuplicateToolCall(
            parsed.toolCall!,
            toolCalls,
            duplicateWindow
          )) {
            onDuplicateDetected?.(parsed.toolCall!);
            
            // Add warning message to conversation
            messages.push({
              role: 'assistant',
              content: llmResponse
            });
            
            messages.push({
              role: 'system',
              content: `⚠️ WARNING: You just called "${parsed.toolCall!.tool}" with the same arguments. This looks like a loop. Please try a DIFFERENT approach or provide a final answer if you have enough information.`
            });
            
            // Continue loop to give LLM a chance to break out
            continue;
          }

          onToolCall?.(parsed.toolCall!);

          // DELEGATE to Tool Manager - PTK KHÔNG execute tool
          const tool = toolMap.get(parsed.toolCall!.tool)!;
          const toolResult = await tool.handler(parsed.toolCall!.args);

          toolCalls.push(parsed.toolCall!);
          toolCallCount++;  // Increment counter

          // Add to conversation
          messages.push({
            role: 'assistant',
            content: llmResponse
          });

          messages.push({
            role: 'tool',
            content: this.formatter.formatToolResult({
              success: true,
              data: toolResult,
              error: null
            })
          });

          // Continue loop - call LLM again với tool result
        }

      } catch (error) {
        onError?.(error as Error);
        
        return {
          success: false,
          content: '',
          error: (error as Error).message,
          iterations: iteration,
          messages,
          toolCalls,
          totalToolCalls: toolCallCount,
          duration: Date.now() - startTime
        };
      }
    }

    // Max iterations reached
    return {
      success: false,
      content: '',
      error: `Max iterations reached (${maxIterations}). LLM did not provide final answer.`,
      iterations: iteration,
      messages,
      toolCalls,
      totalToolCalls: toolCallCount,
      duration: Date.now() - startTime
    };
  }
  
  /**
   * Check if tool call is duplicate of recent calls
   * Detect infinite loops where LLM keeps calling same tool
   */
  private isDuplicateToolCall(
    toolCall: PTKToolCall,
    history: PTKToolCall[],
    window: number
  ): boolean {
    // Check last N tool calls
    const recentCalls = history.slice(-window);
    
    return recentCalls.some(recent => {
      // Same tool name
      if (recent.tool !== toolCall.tool) return false;
      
      // Same arguments (deep compare)
      return JSON.stringify(recent.args) === JSON.stringify(toolCall.args);
    });
  }
  
  formatPrompt(
    prompt: string,
    tools: PTKTool[],
    history?: PTKMessage[]
  ): string {
    const systemPrompt = this.formatter.formatSystemPrompt(tools);
    
    const messages: PTKMessage[] = [
      { role: 'system', content: systemPrompt },
      ...(history || []),
      { role: 'user', content: prompt }
    ];
    
    return this.formatter.formatConversation(messages);
  }
  
  parseResponse(response: string): PTKResponse {
    return this.parser.parse(response);
  }
}
```

**Key Points:**
- `orchestrateToolCalling()` thay vì `execute()` - rõ ràng hơn về responsibility
- PTK Manager **KHÔNG** execute LLM - nó call `llmManager.call()`
- PTK Manager **KHÔNG** execute tools - nó call `tool.handler()`
- PTK Manager chỉ **orchestrate** flow: format → delegate LLM → parse → delegate tool → loop

---

## Tool Calling Flow

```
1. User: "Read package.json and tell me the version"

2. PTK Manager receives prompt + tools: ['read_file']

3. PTKFormatter build system prompt:
   "You have access to these tools:
    • read_file: Read content of a file
      Parameters:
        - path: string (required) - File path
    
    Use <PTK_CALL> format when you need to call a tool"

4. PTK Manager → DELEGATE to LLM Manager
   llmManager.call(formattedPrompt)

5. LLM Manager → Execute LLM call (AI Studio/OpenAI/etc.)
   Returns response:
   "I'll read the package.json file.
    <PTK_CALL>
    {
      "tool": "read_file",
      "args": {"path": "package.json"},
      "reasoning": "Need to read package.json to get version"
    }
    </PTK_CALL>"

6. PTKParser detects tool call in response

7. PTK Manager validates tool call (tool exists? args valid?)

8. PTK Manager → DELEGATE to Tool Manager
   toolManager.execute('read_file', {path: 'package.json'})

9. Tool Manager → Execute tool
   Returns:
   {
     "content": "{\"name\": \"my-app\", \"version\": \"1.2.3\"}",
     "size": 45
   }

10. PTKFormatter format tool result:
    "PTK_RESULT: {\"content\": \"...\", \"size\": 45}"

11. PTK Manager adds result to conversation

12. PTK Manager → DELEGATE to LLM Manager again
    llmManager.call(conversationWithToolResult)

13. LLM Manager → Execute LLM call
    Returns: "The version is 1.2.3"

14. PTKParser detects text response (no tool call)

15. PTK Manager returns final result to caller
```

**Key: PTK Manager orchestrates, LLM Manager và Tool Manager execute**

---

## Integration với Execution Manager

```typescript
// Trong Execution Manager

class ExecutionManager {
  async executeStep(step: Step, context: ExecutionContext): Promise<StepResult> {
    if (step.actionType === ActionType.PTK) {
      // Use PTK Manager for step with tool calling
      
      const prompt = this.interpolatePrompt(
        step.config.ptk.prompt,
        context
      );
      
      const result = await this.ptkManager.execute(prompt, {
        tools: step.config.ptk.tools, // Tool names: ['read_file', 'search_code']
        maxIterations: step.config.ptk.maxIterations || 5,
        
        onToolCall: (toolCall) => {
          console.log(`Tool called: ${toolCall.tool}`, toolCall.args);
        },
        
        onIteration: (info) => {
          console.log(`Iteration ${info.iteration}: ${info.type}`);
        }
      });
      
      return {
        stepId: step.stepId,
        success: result.success,
        output: result.content,
        metadata: {
          iterations: result.iterations,
          toolCalls: result.toolCalls,
          totalTokens: result.totalTokens
        }
      };
    }
    
    // ... other action types
  }
}
```

---

## Dependencies

PTK Manager depends on:

```typescript
interface IPTKManager {
  constructor(
    private llmManager: ILLMManager,      // To call LLM
    private toolManager: IToolManager,    // To execute tools
    private contextManager: IContextManager // To store conversation history
  );
}
```

**Dependency Flow:**
```
PTK Manager
    ├─ uses → LLM Manager (for LLM calls)
    ├─ uses → Tool Manager (for tool execution)
    └─ uses → Context Manager (for history)
```

---

## Error Handling

```typescript
class PTKExecutionError extends Error {
  constructor(
    message: string,
    public code: PTKErrorCode,
    public context?: any
  ) {
    super(message);
  }
}

enum PTKErrorCode {
  TOOL_NOT_FOUND = 'TOOL_NOT_FOUND',
  INVALID_TOOL_CALL = 'INVALID_TOOL_CALL',
  MAX_ITERATIONS_REACHED = 'MAX_ITERATIONS_REACHED',
  MAX_TOOL_CALLS_REACHED = 'MAX_TOOL_CALLS_REACHED',  // New: Prevent infinite loop
  TOOL_EXECUTION_FAILED = 'TOOL_EXECUTION_FAILED',
  LLM_CALL_FAILED = 'LLM_CALL_FAILED',
  PARSE_ERROR = 'PARSE_ERROR',
  DUPLICATE_TOOL_CALL = 'DUPLICATE_TOOL_CALL'  // New: Detect loops
}
```

---

## Usage Examples

### Example 1: Simple Tool Calling

```typescript
const ptkManager = new PTKManager(llmManager, toolManager, contextManager);

// PTK orchestrates, LLM Manager executes LLM calls
const result = await ptkManager.orchestrateToolCalling(
  "Read the test.ts file and count the number of functions",
  {
    tools: ['read_file']
  }
);

console.log(result.content);
// "The test.ts file contains 5 functions"
```

### Example 2: Multiple Tool Calls

```typescript
const result = await ptkManager.orchestrateToolCalling(
  "Find all TypeScript files and check if they have tests",
  {
    tools: ['search_files', 'read_file'],
    maxIterations: 10,
    
    onToolCall: (toolCall) => {
      console.log(`Calling ${toolCall.tool}:`, toolCall.args);
    }
  }
);

// PTK orchestrates:
// 1. Format prompt → Delegate to LLM Manager
// 2. LLM returns tool call → Parse
// 3. Delegate to Tool Manager (search_files)
// 4. Format result → Delegate to LLM Manager again
// 5. LLM returns tool call → Parse
// 6. Delegate to Tool Manager (read_file) multiple times
// 7. LLM returns final answer
```

### Example 3: With Callbacks

```typescript
const result = await ptkManager.orchestrateToolCalling(
  "Run tests and fix any failures",
  {
    tools: ['run_tests', 'read_file', 'write_file'],
    maxIterations: 10,
    
    onIteration: (info) => {
      updateProgressBar(`Iteration ${info.iteration}: ${info.type}`);
    },
    
    onToolCall: (toolCall) => {
      showNotification(`Running tool: ${toolCall.tool}`);
    },
    
    onError: (error) => {
      showError(`PTK error: ${error.message}`);
    }
  }
);
```

---

## Testing

```typescript
describe('PTKManager', () => {
  test('should execute simple tool call', async () => {
    const mockLLM = {
      call: jest.fn()
        .mockResolvedValueOnce('<PTK_CALL>{"tool":"read_file","args":{"path":"test.ts"}}</PTK_CALL>')
        .mockResolvedValueOnce('The file contains 5 functions')
    };
    
    const mockTool = {
      execute: jest.fn().mockResolvedValue({ content: 'function test() {}...' })
    };
    
    const ptkManager = new PTKManager(mockLLM, mockTool, contextManager);
    
    const result = await ptkManager.execute('Read test.ts', {
      tools: ['read_file']
    });
    
    expect(result.success).toBe(true);
    expect(result.iterations).toBe(2);
    expect(result.content).toContain('5 functions');
  });
  
  test('should handle max iterations', async () => {
    const mockLLM = {
      call: jest.fn().mockResolvedValue('<PTK_CALL>{"tool":"read_file","args":{"path":"test.ts"}}</PTK_CALL>')
    };
    
    const ptkManager = new PTKManager(mockLLM, toolManager, contextManager);
    
    const result = await ptkManager.execute('Read test.ts', {
      tools: ['read_file'],
      maxIterations: 3
    });
    
    expect(result.success).toBe(false);
    expect(result.error).toContain('Max iterations');
  });
});
```

---

## Configuration

```typescript
interface PTKManagerConfig {
  defaultMaxIterations: number; // Default: 5
  defaultTimeout: number; // Default: 30000ms
  enableLogging: boolean; // Default: true
  retryFailedTools: boolean; // Default: true
  maxToolRetries: number; // Default: 2
}
```

---

## Summary

PTK Manager là:
- **Gateway** cho LLM interactions có tool calling
- **Orchestrator** giữa LLM và Tools
- **Protocol handler** cho PTK (Prompt-based Tool Kalling)

Nó không thay thế LLM Manager hay Tool Manager mà sử dụng cả hai để implement tool calling protocol.
