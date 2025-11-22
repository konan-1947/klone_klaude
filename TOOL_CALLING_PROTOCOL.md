# Tool Calling Protocol

## Tổng Quan

Protocol này định nghĩa cách LLM (thông qua browser automation) giao tiếp với Tool Manager để thực hiện các operations trong IDE.

Vì không sử dụng API trực tiếp (như OpenAI function calling), chúng ta sử dụng **text-based protocol** với các tags đặc biệt để LLM signal khi cần gọi tool.

---

## Protocol Format

### 1. Tool Call Request

Khi LLM cần gọi tool, nó phải trả về response theo format:

```xml
<TOOL_CALL>
{
  "tool": "tool_name",
  "args": {
    "param1": "value1",
    "param2": "value2"
  },
  "reasoning": "Optional explanation why this tool is needed"
}
</TOOL_CALL>
```

### 2. Tool Result Response

Sau khi tool execute, system sẽ gửi lại cho LLM:

```
TOOL_RESULT: {
  "success": true,
  "data": {
    // tool output
  },
  "error": null
}
```

### 3. Final Answer

Khi LLM đã có đủ thông tin, trả về text thông thường (không có tags):

```
Based on the file content, the version is 1.0.0
```

---

## System Prompt Template

LLM sẽ được inject system prompt này:

```
You are an AI coding assistant with access to these tools:

AVAILABLE TOOLS:
- read_file(path: string): Read content of a file
- write_file(path: string, content: string): Write content to a file
- list_files(directory: string, pattern?: string): List files in directory
- search_code(query: string, options?: object): Search code in codebase
- get_diagnostics(file?: string): Get errors and warnings

TOOL CALLING PROTOCOL:
When you need to use a tool, respond with this EXACT format:

<TOOL_CALL>
{
  "tool": "tool_name",
  "args": {"arg1": "value1"},
  "reasoning": "why you need this tool"
}
</TOOL_CALL>

IMPORTANT RULES:
1. Use ONLY ONE tool call per response
2. JSON inside <TOOL_CALL> must be valid
3. "tool" must match exactly one of the available tools
4. "args" must include all required parameters
5. After receiving TOOL_RESULT, you can make another tool call or provide final answer
6. When you have the final answer, respond normally without any tags

EXAMPLES:
User: "What's in package.json?"
You: <TOOL_CALL>
{
  "tool": "read_file",
  "args": {"path": "package.json"},
  "reasoning": "Need to read package.json to answer"
}
</TOOL_CALL>

System: TOOL_RESULT: {"success": true, "data": {"content": "{\"version\": \"1.0.0\"}"}}

You: The package.json contains version 1.0.0
```

---

## Conversation Flow

### Example 1: Single Tool Call

```
USER: "Read package.json and tell me the version"

ASSISTANT (Iteration 1):
<TOOL_CALL>
{
  "tool": "read_file",
  "args": {"path": "package.json"},
  "reasoning": "Need to read package.json to get version"
}
</TOOL_CALL>

SYSTEM:
TOOL_RESULT: {
  "success": true,
  "data": {
    "content": "{\n  \"name\": \"my-app\",\n  \"version\": \"1.0.0\"\n}",
    "lines": 4
  }
}

ASSISTANT (Iteration 2):
The version in package.json is 1.0.0
```

### Example 2: Multiple Tool Calls

```
USER: "Find all TypeScript files and count them"

ASSISTANT (Iteration 1):
<TOOL_CALL>
{
  "tool": "list_files",
  "args": {"directory": ".", "pattern": "**/*.ts"},
  "reasoning": "Need to list all TypeScript files first"
}
</TOOL_CALL>

SYSTEM:
TOOL_RESULT: {
  "success": true,
  "data": {
    "files": ["src/index.ts", "src/utils.ts", "test/test.ts"],
    "count": 3
  }
}

ASSISTANT (Iteration 2):
I found 3 TypeScript files:
1. src/index.ts
2. src/utils.ts
3. test/test.ts
```

### Example 3: Tool Call with Error

```
USER: "Read missing-file.txt"

ASSISTANT (Iteration 1):
<TOOL_CALL>
{
  "tool": "read_file",
  "args": {"path": "missing-file.txt"},
  "reasoning": "Need to read the file content"
}
</TOOL_CALL>

SYSTEM:
TOOL_RESULT: {
  "success": false,
  "data": null,
  "error": "File not found: missing-file.txt"
}

ASSISTANT (Iteration 2):
I cannot read missing-file.txt because the file does not exist. Would you like me to create it?
```

---

## Parsing Rules

### Valid Tool Call

```xml
<TOOL_CALL>
{"tool": "read_file", "args": {"path": "test.ts"}}
</TOOL_CALL>
```

✅ Valid:
- Has opening and closing tags
- Contains valid JSON
- Tool name exists
- Required args provided

### Invalid Tool Calls

```xml
<!-- Missing closing tag -->
<TOOL_CALL>
{"tool": "read_file"}

<!-- Invalid JSON -->
<TOOL_CALL>
{tool: "read_file", args: {path: "test.ts"}}
</TOOL_CALL>

<!-- Unknown tool -->
<TOOL_CALL>
{"tool": "unknown_tool", "args": {}}
</TOOL_CALL>

<!-- Missing required args -->
<TOOL_CALL>
{"tool": "read_file", "args": {}}
</TOOL_CALL>
```

❌ Invalid - Parser sẽ treat như text response

---

## Implementation Details

### 1. Regex Pattern

```typescript
const TOOL_CALL_PATTERN = /<TOOL_CALL>\s*([\s\S]*?)\s*<\/TOOL_CALL>/;
```

### 2. Parser Logic

```typescript
function parseResponse(response: string): ParsedResponse {
  const match = response.match(TOOL_CALL_PATTERN);
  
  if (!match) {
    return { type: 'text', content: response };
  }

  try {
    const toolCall = JSON.parse(match[1]);
    
    // Validate
    if (!toolCall.tool || !toolCall.args) {
      throw new Error('Invalid tool call format');
    }

    return {
      type: 'tool_call',
      tool: toolCall.tool,
      args: toolCall.args,
      reasoning: toolCall.reasoning
    };
  } catch (e) {
    // JSON parse error - treat as text
    return { type: 'text', content: response };
  }
}
```

### 3. Validation Rules

```typescript
interface ToolCallValidation {
  isValid: boolean;
  error?: string;
}

function validateToolCall(
  toolCall: any,
  availableTools: Tool[]
): ToolCallValidation {
  // 1. Check tool exists
  const tool = availableTools.find(t => t.name === toolCall.tool);
  if (!tool) {
    return {
      isValid: false,
      error: `Unknown tool: ${toolCall.tool}`
    };
  }

  // 2. Check required parameters
  const requiredParams = tool.parameters.required || [];
  const providedParams = Object.keys(toolCall.args || {});
  
  for (const param of requiredParams) {
    if (!providedParams.includes(param)) {
      return {
        isValid: false,
        error: `Missing required parameter: ${param}`
      };
    }
  }

  // 3. Check parameter types (optional but recommended)
  // ...

  return { isValid: true };
}
```

---

## Error Handling

### 1. Parse Errors

```typescript
// Malformed JSON
try {
  JSON.parse(match[1]);
} catch (e) {
  console.warn('Failed to parse tool call JSON, treating as text');
  return { type: 'text', content: response };
}
```

### 2. Validation Errors

```typescript
const validation = validateToolCall(toolCall, availableTools);
if (!validation.isValid) {
  // Send error back to LLM
  return {
    role: 'system',
    content: `TOOL_ERROR: ${validation.error}. Please try again with correct format.`
  };
}
```

### 3. Execution Errors

```typescript
try {
  const result = await tool.handler(toolCall.args);
  return {
    success: true,
    data: result,
    error: null
  };
} catch (e) {
  return {
    success: false,
    data: null,
    error: e.message
  };
}
```

---

## Best Practices

### For LLM Prompting

1. **Clear Instructions**: Luôn include tool calling format trong system prompt
2. **Examples**: Provide 2-3 examples của successful tool calls
3. **Constraints**: Nêu rõ "ONE tool per response"
4. **Error Messages**: Return clear error messages khi tool call fails

### For Implementation

1. **Whitespace Handling**: Regex phải handle whitespace trong tags
2. **Case Sensitivity**: Tool names case-sensitive
3. **JSON Validation**: Always validate JSON before parsing
4. **Timeout**: Set max iterations để prevent infinite loops
5. **Logging**: Log all tool calls cho debugging

### For Tool Definitions

```typescript
// Good: Clear, specific
{
  name: "read_file",
  description: "Read the complete content of a file from disk",
  parameters: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "Absolute or relative file path (e.g., 'src/index.ts')"
      }
    },
    required: ["path"]
  }
}

// Bad: Vague, unclear
{
  name: "read",
  description: "Read stuff",
  parameters: { /* unclear */ }
}
```

---

## Security Considerations

1. **Path Traversal**: Validate file paths
   ```typescript
   if (path.includes('..')) {
     throw new Error('Path traversal not allowed');
   }
   ```

2. **File Size Limits**: Limit file size để prevent memory issues
   ```typescript
   const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
   ```

3. **Allowed Directories**: Restrict tool access
   ```typescript
   const ALLOWED_DIRS = [workspaceRoot, tempDir];
   ```

4. **Dangerous Operations**: Require confirmation
   ```typescript
   if (tool.dangerous) {
     await askUserConfirmation(tool.name, args);
   }
   ```

---

## Extension Points

### Custom Tool Registration

```typescript
toolManager.registerTool({
  name: 'custom_search',
  description: 'Search with custom logic',
  parameters: { /* ... */ },
  handler: async (args) => {
    // Custom implementation
  }
});
```

### Tool Middleware

```typescript
toolManager.use((toolCall, next) => {
  console.log(`Executing: ${toolCall.tool}`);
  const start = Date.now();
  const result = await next();
  console.log(`Duration: ${Date.now() - start}ms`);
  return result;
});
```

### Alternative Protocols

Nếu cần, có thể support alternative formats:

```typescript
// YAML-style
TOOL: read_file
ARGS:
  path: package.json

// Function call style  
read_file(path="package.json")

// XML style
<tool name="read_file">
  <arg name="path">package.json</arg>
</tool>
```

---

## Testing

### Unit Tests

```typescript
describe('Tool Call Parser', () => {
  it('should parse valid tool call', () => {
    const response = '<TOOL_CALL>{"tool":"read_file","args":{"path":"test.ts"}}</TOOL_CALL>';
    const parsed = parser.parse(response);
    expect(parsed.type).toBe('tool_call');
    expect(parsed.tool).toBe('read_file');
  });

  it('should handle malformed JSON', () => {
    const response = '<TOOL_CALL>{invalid json}</TOOL_CALL>';
    const parsed = parser.parse(response);
    expect(parsed.type).toBe('text');
  });
});
```

### Integration Tests

```typescript
describe('LLM Manager with Tools', () => {
  it('should execute tool and return result', async () => {
    const response = await llmManager.call('Read package.json');
    expect(response).toContain('version');
  });
});
```

---

## Performance Optimization

1. **Caching**: Cache tool results cho repeated calls
2. **Parallel Execution**: Nếu cần multiple tools, execute parallel
3. **Streaming**: Stream large file reads
4. **Debouncing**: Debounce frequent tool calls

---

## Migration Path

### From Current System

1. Add `ResponseParser` class
2. Update `LLMManager` với tool support
3. Create `ToolManager` 
4. Register basic tools
5. Update system prompt
6. Test với simple use cases
7. Gradually add more tools

### Future Enhancements

- Support multi-tool calls trong single response
- Tool call batching
- Tool result streaming
- Visual tool call inspector
- Tool usage analytics
