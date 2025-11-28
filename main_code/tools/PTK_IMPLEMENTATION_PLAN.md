# PTK Manager Implementation Plan

## Overview

Implement PTK (Prompt-based Tool Kalling) Manager để orchestrate tool calling loop giữa LLM và Tools. PTKManager cho phép AI tự động gọi tools khi cần thiết.

**Base từ:** `manager_interfaces/PTKManager.md` và `PTK_DESIGN.md`

**Dependencies:**
- ✅ ToolManager (đã có)
- ✅ AIStudioBrowser (đã có)
- ❌ LLMManager (cần tạo)
- ❌ PTKFormatter (cần tạo)
- ❌ PTKParser (cần tạo)

---

## Architecture

```
User Message
    ↓
PTKManager.orchestrateToolCalling()
    ↓
├─ PTKFormatter → Format prompt với tool definitions
├─ LLMManager → Call AI (delegate to AIStudioBrowser)
├─ PTKParser → Parse response, detect <PTK_CALL>
├─ ToolManager → Execute tool nếu có tool call
└─ Loop lại cho đến khi có final answer
```

---

## File Structure

```
src/core/
├── ptk/
│   ├── types.ts                    # Type definitions
│   ├── errors.ts                   # Error classes
│   ├── PTKFormatter.ts             # Format prompts
│   ├── PTKParser.ts                # Parse responses
│   ├── PTKManager.ts               # Main orchestrator
│   └── index.ts                    # Exports
│
├── llm/
│   ├── ILLMManager.ts              # LLM interface
│   ├── LLMManager.ts               # LLM manager
│   ├── providers/
│   │   ├── AIStudioLLMProvider.ts  # AI Studio wrapper
│   │   └── index.ts
│   └── index.ts
│
├── tools/
│   ├── ToolManager.ts              # ✅ Đã có
│   ├── handlers/                   # ✅ Đã có
│   ├── definitions/                # Tool definitions cho PTK
│   │   ├── readFileTool.ts
│   │   └── index.ts
│   ├── ToolRegistry.ts             # Registry cho PTK tools
│   └── index.ts
│
└── context/
    ├── ContextManager.ts           # Conversation history
    └── index.ts
```

---

## Phase 1: Foundation - PTK Types & Interfaces

### File: `src/core/ptk/types.ts`

#### Types cần định nghĩa:

```typescript
// Tool definition
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

// Tool call từ LLM
interface PTKToolCall {
    tool: string;
    args: Record<string, any>;
    reasoning?: string;
}

// Message trong conversation
interface PTKMessage {
    role: 'system' | 'user' | 'assistant' | 'tool';
    content: string;
}

// Response từ LLM
interface PTKResponse {
    type: 'text' | 'tool_call';
    content?: string;
    toolCall?: PTKToolCall;
    raw: string;
}

// Execute options
interface PTKExecuteOptions {
    tools?: PTKTool[];
    maxIterations?: number;
    maxToolCalls?: number;
    timeout?: number;
    onIteration?: (info: IterationInfo) => void;
    onToolCall?: (toolCall: PTKToolCall) => void;
    onError?: (error: Error) => void;
    model?: string;
    temperature?: number;
}

// Execute result
interface PTKExecuteResult {
    success: boolean;
    content: string;
    iterations: number;
    messages: PTKMessage[];
    toolCalls: PTKToolCall[];
    totalToolCalls: number;
    error?: string;
    duration: number;
}

// Tool result
interface PTKToolResult {
    success: boolean;
    data?: any;
    error?: string;
}

// Parameter definition
interface PTKParameter {
    type: 'string' | 'number' | 'boolean' | 'object' | 'array';
    description: string;
    enum?: any[];
    items?: PTKParameter;
}

// Iteration info
interface IterationInfo {
    iteration: number;
    type: 'text' | 'tool_call';
    content?: string;
    toolCallsSoFar: number;
}
```

### File: `src/core/ptk/errors.ts`

```typescript
enum PTKErrorCode {
    TOOL_NOT_FOUND = 'TOOL_NOT_FOUND',
    INVALID_TOOL_CALL = 'INVALID_TOOL_CALL',
    MAX_ITERATIONS_REACHED = 'MAX_ITERATIONS_REACHED',
    MAX_TOOL_CALLS_REACHED = 'MAX_TOOL_CALLS_REACHED',
    TOOL_EXECUTION_FAILED = 'TOOL_EXECUTION_FAILED',
    LLM_CALL_FAILED = 'LLM_CALL_FAILED',
    PARSE_ERROR = 'PARSE_ERROR',
    DUPLICATE_TOOL_CALL = 'DUPLICATE_TOOL_CALL'
}

class PTKExecutionError extends Error {
    constructor(
        message: string,
        public code: PTKErrorCode,
        public context?: any
    ) {
        super(message);
        this.name = 'PTKExecutionError';
    }
}
```

---

## Phase 2: PTK Formatter

### File: `src/core/ptk/PTKFormatter.ts`

#### Responsibilities:
- Format system prompt với tool definitions
- Format conversation history
- Format tool results

#### Methods:

```typescript
class PTKFormatter {
    /**
     * Build system prompt với tool definitions
     */
    formatSystemPrompt(tools: PTKTool[]): string {
        // Template:
        // "You are a helpful AI assistant with access to tools.
        //  When you need to use a tool, respond with <PTK_CALL> format.
        //  
        //  Available tools:
        //  • read_file: Read content of a file
        //    Parameters:
        //      - path: string (required) - Path to file
        //  
        //  Format: <PTK_CALL>{"tool":"tool_name","args":{...}}</PTK_CALL>"
    }
    
    /**
     * Format tool definitions
     */
    formatToolDefinitions(tools: PTKTool[]): string {
        // Format danh sách tools thành markdown
    }
    
    /**
     * Format conversation history
     */
    formatConversation(messages: PTKMessage[]): string {
        // Combine tất cả messages thành 1 prompt
    }
    
    /**
     * Format tool result để gửi lại LLM
     */
    formatToolResult(result: PTKToolResult): string {
        // Format: "PTK_RESULT: {success: true, data: ...}"
    }
}
```

#### Implementation details:

**System Prompt Template:**
```
You are a helpful AI assistant with access to the following tools:

[TOOL_DEFINITIONS]

When you need to use a tool, respond in this exact format:
<PTK_CALL>
{
  "tool": "tool_name",
  "args": {"param1": "value1"},
  "reasoning": "Why you're calling this tool"
}
</PTK_CALL>

Rules:
- Use tools when you need information you don't have
- Provide clear reasoning for tool calls
- After receiving tool results, analyze and provide final answer
- If you have enough information, provide final answer without more tool calls
```

---

## Phase 3: PTK Parser

### File: `src/core/ptk/PTKParser.ts`

#### Responsibilities:
- Detect `<PTK_CALL>` tags trong response
- Extract và parse JSON
- Validate format

#### Methods:

```typescript
class PTKParser {
    /**
     * Parse LLM response
     */
    parse(response: string): PTKResponse {
        // 1. Check for <PTK_CALL> tags
        // 2. If found → extract và parse JSON
        // 3. If not found → return text response
    }
    
    /**
     * Extract tool call từ response
     */
    extract(response: string): PTKToolCall | null {
        // Regex: /<PTK_CALL>(.*?)<\/PTK_CALL>/s
        // Parse JSON inside tags
    }
    
    /**
     * Validate tool call format
     */
    validate(toolCall: PTKToolCall): PTKValidation {
        // Check:
        // - tool name exists
        // - args is object
        // - required params present
    }
}

interface PTKValidation {
    valid: boolean;
    error?: string;
}
```

#### Implementation details:

**Parse logic:**
```typescript
parse(response: string): PTKResponse {
    const callMatch = response.match(/<PTK_CALL>(.*?)<\/PTK_CALL>/s);
    
    if (!callMatch) {
        return {
            type: 'text',
            content: response.trim(),
            raw: response
        };
    }
    
    try {
        const jsonStr = callMatch[1].trim();
        const toolCall = JSON.parse(jsonStr);
        
        return {
            type: 'tool_call',
            toolCall: toolCall,
            raw: response
        };
    } catch (error) {
        throw new PTKExecutionError(
            'Failed to parse tool call JSON',
            PTKErrorCode.PARSE_ERROR
        );
    }
}
```

---

## Phase 4: LLM Integration

### File: `src/core/llm/ILLMManager.ts`

```typescript
interface ILLMManager {
    call(prompt: string, options?: LLMOptions): Promise<string>;
}

interface LLMOptions {
    model?: string;
    temperature?: number;
    maxTokens?: number;
}
```

### File: `src/core/llm/providers/AIStudioLLMProvider.ts`

Wrap existing `AIStudioBrowser`:

```typescript
class AIStudioLLMProvider implements ILLMManager {
    constructor(private aiStudioBrowser: AIStudioBrowser) {}
    
    async call(prompt: string, options?: LLMOptions): Promise<string> {
        try {
            return await this.aiStudioBrowser.sendPrompt(prompt);
        } catch (error) {
            throw new Error(`AI Studio call failed: ${error.message}`);
        }
    }
}
```

### File: `src/core/llm/LLMManager.ts`

Support multiple providers:

```typescript
type LLMProvider = 'ai-studio' | 'groq' | 'openai';

class LLMManager implements ILLMManager {
    private providers: Map<LLMProvider, ILLMManager>;
    private currentProvider: LLMProvider;
    
    constructor() {
        this.providers = new Map();
        this.currentProvider = 'ai-studio';
    }
    
    registerProvider(name: LLMProvider, provider: ILLMManager) {
        this.providers.set(name, provider);
    }
    
    setProvider(name: LLMProvider) {
        this.currentProvider = name;
    }
    
    async call(prompt: string, options?: LLMOptions): Promise<string> {
        const provider = this.providers.get(this.currentProvider);
        if (!provider) {
            throw new Error(`Provider ${this.currentProvider} not registered`);
        }
        return await provider.call(prompt, options);
    }
}
```

---

## Phase 5: Tool Definitions

### File: `src/core/tools/definitions/readFileTool.ts`

```typescript
import { PTKTool } from '../../ptk/types';

export const readFileTool: PTKTool = {
    name: 'read_file',
    description: 'Read contents of a text file from the file system',
    parameters: {
        type: 'object',
        properties: {
            path: {
                type: 'string',
                description: 'Path to the file (relative or absolute)'
            }
        },
        required: ['path']
    },
    handler: async (args: { path: string }) => {
        // Will be injected by ToolRegistry
        // Just a placeholder, actual execution via ToolManager
        return null;
    }
};
```

### File: `src/core/tools/ToolRegistry.ts`

```typescript
class ToolRegistry {
    private tools: Map<string, PTKTool>;
    
    constructor(private toolManager: ToolManager) {
        this.tools = new Map();
        this.registerDefaultTools();
    }
    
    private registerDefaultTools() {
        this.register(readFileTool);
    }
    
    register(tool: PTKTool) {
        // Inject real handler
        const toolWithHandler: PTKTool = {
            ...tool,
            handler: async (args) => {
                const result = await this.toolManager.execute(tool.name, args);
                return result;
            }
        };
        
        this.tools.set(tool.name, toolWithHandler);
    }
    
    get(name: string): PTKTool | undefined {
        return this.tools.get(name);
    }
    
    getAll(): PTKTool[] {
        return Array.from(this.tools.values());
    }
    
    has(name: string): boolean {
        return this.tools.has(name);
    }
}
```

---

## Phase 6: Context Manager

### File: `src/core/context/ContextManager.ts`

```typescript
class ContextManager {
    private conversations: Map<string, PTKMessage[]>;
    
    constructor() {
        this.conversations = new Map();
    }
    
    createConversation(id: string): void {
        this.conversations.set(id, []);
    }
    
    addMessage(conversationId: string, message: PTKMessage): void {
        const messages = this.conversations.get(conversationId) || [];
        messages.push(message);
        this.conversations.set(conversationId, messages);
    }
    
    getMessages(conversationId: string): PTKMessage[] {
        return this.conversations.get(conversationId) || [];
    }
    
    clearConversation(conversationId: string): void {
        this.conversations.delete(conversationId);
    }
}
```

---

## Phase 7: PTK Manager

### File: `src/core/ptk/PTKManager.ts`

Main orchestrator:

```typescript
class PTKManager {
    private formatter: PTKFormatter;
    private parser: PTKParser;
    
    constructor(
        private llmManager: LLMManager,
        private toolRegistry: ToolRegistry,
        private contextManager: ContextManager
    ) {
        this.formatter = new PTKFormatter();
        this.parser = new PTKParser();
    }
    
    async orchestrateToolCalling(
        prompt: string,
        options: PTKExecuteOptions = {}
    ): Promise<PTKExecuteResult> {
        const {
            tools = [],
            maxIterations = 10,
            maxToolCalls = 20,
            onIteration,
            onToolCall,
            onError
        } = options;
        
        const availableTools = tools.length > 0 
            ? tools.map(name => this.toolRegistry.get(name)!).filter(Boolean)
            : this.toolRegistry.getAll();
        
        const toolMap = new Map(availableTools.map(t => [t.name, t]));
        const messages: PTKMessage[] = [];
        const toolCalls: PTKToolCall[] = [];
        
        // Build system prompt
        const systemPrompt = this.formatter.formatSystemPrompt(availableTools);
        messages.push({ role: 'system', content: systemPrompt });
        messages.push({ role: 'user', content: prompt });
        
        let iteration = 0;
        let toolCallCount = 0;
        const startTime = Date.now();
        
        while (iteration < maxIterations) {
            iteration++;
            
            try {
                // Format conversation
                const fullPrompt = this.formatter.formatConversation(messages);
                
                // Call LLM
                const llmResponse = await this.llmManager.call(fullPrompt, {
                    model: options.model,
                    temperature: options.temperature
                });
                
                // Parse response
                const parsed = this.parser.parse(llmResponse);
                
                onIteration?.({
                    iteration,
                    type: parsed.type,
                    content: parsed.content,
                    toolCallsSoFar: toolCallCount
                });
                
                if (parsed.type === 'text') {
                    // Done
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
                    // Check limit
                    if (toolCallCount >= maxToolCalls) {
                        throw new PTKExecutionError(
                            `Max tool calls reached (${maxToolCalls})`,
                            PTKErrorCode.MAX_TOOL_CALLS_REACHED
                        );
                    }
                    
                    // Validate
                    const validation = this.parser.validate(parsed.toolCall!);
                    if (!validation.valid) {
                        throw new PTKExecutionError(
                            `Invalid tool call: ${validation.error}`,
                            PTKErrorCode.INVALID_TOOL_CALL
                        );
                    }
                    
                    // Check tool exists
                    const tool = toolMap.get(parsed.toolCall!.tool);
                    if (!tool) {
                        throw new PTKExecutionError(
                            `Tool not found: ${parsed.toolCall!.tool}`,
                            PTKErrorCode.TOOL_NOT_FOUND
                        );
                    }
                    
                    onToolCall?.(parsed.toolCall!);
                    
                    // Execute tool
                    const toolResult = await tool.handler(parsed.toolCall!.args);
                    
                    toolCalls.push(parsed.toolCall!);
                    toolCallCount++;
                    
                    // Add to conversation
                    messages.push({
                        role: 'assistant',
                        content: llmResponse
                    });
                    
                    messages.push({
                        role: 'tool',
                        content: this.formatter.formatToolResult({
                            success: toolResult.success,
                            data: toolResult.data || toolResult,
                            error: toolResult.error
                        })
                    });
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
            error: `Max iterations reached (${maxIterations})`,
            iterations: iteration,
            messages,
            toolCalls,
            totalToolCalls: toolCallCount,
            duration: Date.now() - startTime
        };
    }
}
```

---

## Phase 8: Integration

### Update: `src/providers/chat/ChatViewProvider.ts`

```typescript
export class ChatViewProvider implements vscode.WebviewViewProvider {
    private ptkManager?: PTKManager;
    private llmManager?: LLMManager;
    private toolRegistry?: ToolRegistry;
    
    constructor(
        private readonly _extensionUri: vscode.Uri,
        private context: vscode.ExtensionContext
    ) {
        this.cookieManager = new CookieManager(context);
    }
    
    private async initializePTK() {
        if (this.ptkManager) return;
        
        const workspacePath = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
        if (!workspacePath) return;
        
        // Initialize managers
        const ignoreManager = new IgnoreManager(workspacePath);
        await ignoreManager.initialize();
        
        const toolManager = new ToolManager(workspacePath, ignoreManager);
        this.toolRegistry = new ToolRegistry(toolManager);
        
        // Initialize LLM
        this.llmManager = new LLMManager();
        const aiStudioProvider = new AIStudioLLMProvider(this.aiStudioBrowser!);
        this.llmManager.registerProvider('ai-studio', aiStudioProvider);
        
        // Initialize PTK
        const contextManager = new ContextManager();
        this.ptkManager = new PTKManager(
            this.llmManager,
            this.toolRegistry,
            contextManager
        );
    }
}
```

### Update: `src/providers/chat/handleSendMessage.ts`

```typescript
export const handleSendMessage = async (
    view: vscode.WebviewView | undefined,
    ptkManager: PTKManager | null,
    isInitialized: boolean,
    message: string
): Promise<void> => {
    if (!ptkManager || !isInitialized) {
        view?.webview.postMessage({
            type: 'error',
            message: 'Browser chưa được khởi tạo'
        });
        return;
    }
    
    try {
        const result = await ptkManager.orchestrateToolCalling(message, {
            tools: ['read_file'],  // Available tools
            maxIterations: 10,
            
            onToolCall: (toolCall) => {
                view?.webview.postMessage({
                    type: 'toolCall',
                    tool: toolCall.tool,
                    args: toolCall.args
                });
            },
            
            onIteration: (info) => {
                view?.webview.postMessage({
                    type: 'iteration',
                    iteration: info.iteration,
                    callType: info.type
                });
            }
        });
        
        if (result.success) {
            view?.webview.postMessage({
                type: 'receiveMessage',
                message: result.content,
                metadata: {
                    iterations: result.iterations,
                    toolCalls: result.toolCalls.length
                }
            });
        } else {
            view?.webview.postMessage({
                type: 'error',
                message: result.error
            });
        }
        
    } catch (error: any) {
        view?.webview.postMessage({
            type: 'error',
            message: `Lỗi: ${error.message}`
        });
    }
};
```

---

## Testing Strategy

### Unit Tests:

**PTKFormatter:**
- Test formatSystemPrompt() với 0, 1, nhiều tools
- Test formatConversation() với các message types
- Test formatToolResult() với success/error

**PTKParser:**
- Test parse() với text response
- Test parse() với tool call response
- Test parse() với invalid JSON
- Test validate() với valid/invalid tool calls

**PTKManager:**
- Test simple tool call (1 iteration)
- Test multiple tool calls (nhiều iterations)
- Test max iterations limit
- Test max tool calls limit
- Test error handling

### Integration Tests:

- End-to-end: User message → Tool call → Final answer
- Test với multiple tools
- Test error recovery

---

## Implementation Checklist

### Phase 1: Foundation
- [ ] `src/core/ptk/types.ts`
- [ ] `src/core/ptk/errors.ts`
- [ ] `src/core/ptk/index.ts`

### Phase 2: Formatter
- [ ] `src/core/ptk/PTKFormatter.ts`
- [ ] Test PTKFormatter

### Phase 3: Parser
- [ ] `src/core/ptk/PTKParser.ts`
- [ ] Test PTKParser

### Phase 4: LLM
- [ ] `src/core/llm/ILLMManager.ts`
- [ ] `src/core/llm/providers/AIStudioLLMProvider.ts`
- [ ] `src/core/llm/LLMManager.ts`
- [ ] `src/core/llm/index.ts`
- [ ] Test LLM integration

### Phase 5: Tools
- [ ] `src/core/tools/definitions/readFileTool.ts`
- [ ] `src/core/tools/ToolRegistry.ts`
- [ ] `src/core/tools/definitions/index.ts`
- [ ] Test ToolRegistry

### Phase 6: Context
- [ ] `src/core/context/ContextManager.ts`
- [ ] `src/core/context/index.ts`

### Phase 7: PTK Manager
- [ ] `src/core/ptk/PTKManager.ts`
- [ ] Test PTKManager (unit)
- [ ] Test PTKManager (integration)

### Phase 8: Integration
- [ ] Update ChatViewProvider
- [ ] Update handleSendMessage
- [ ] End-to-end testing
- [ ] UI improvements

---

## Success Criteria

### MVP Success:
- [ ] User hỏi: "Đọc file package.json"
- [ ] AI tự động gọi tool read_file
- [ ] AI nhận kết quả và trả lời
- [ ] Hiển thị đúng trong chat UI

### Full Success:
- [ ] Support nhiều tools
- [ ] AI tự động chọn tool đúng
- [ ] Handle errors gracefully
- [ ] Show tool calls trong UI
- [ ] Max iterations/tool calls working
- [ ] Conversation history working

---

## Notes

### Design Decisions:
- PTKManager orchestrates, không execute LLM/tools trực tiếp
- Tools được define riêng, dễ extend
- LLMManager support multiple providers
- Simple protocol với `<PTK_CALL>` tags

### Future Enhancements:
- [ ] Streaming responses
- [ ] Tool call approval UI
- [ ] Tool usage analytics
- [ ] Custom tool definitions
- [ ] Multi-model support (Groq preprocessing)
