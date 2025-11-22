# Tool Manager Interface

## Overview

Tool Manager chịu trách nhiệm execute tools (read_file, write_file, search_files, run_tests, etc.), manage tool registry, và provide tool definitions cho PTK Protocol.

---

## Interface Definition

```typescript
interface IToolManager {
  /**
   * Execute một tool
   * @param toolName - Tên tool
   * @param params - Tool parameters
   * @returns Tool execution result
   */
  execute(toolName: string, params: any): Promise<any>;

  /**
   * Register tool mới
   */
  registerTool(tool: Tool): void;

  /**
   * Unregister tool
   */
  unregisterTool(toolName: string): void;

  /**
   * Get tool definition
   */
  getTool(toolName: string): Tool | undefined;

  /**
   * Get multiple tools
   */
  getTools(toolNames: string[]): Tool[];

  /**
   * List all available tools
   */
  listTools(): Tool[];

  /**
   * Get tools by category
   */
  getToolsByCategory(category: ToolCategory): Tool[];

  /**
   * Validate tool parameters
   */
  validateParams(toolName: string, params: any): ValidationResult;
}
```

---

## Type Definitions

### Tool

```typescript
interface Tool {
  // Identity
  name: string;
  description: string;
  category: ToolCategory;
  
  // Schema (JSON Schema format cho PTK)
  parameters: {
    type: 'object';
    properties: Record<string, ParameterDefinition>;
    required?: string[];
  };
  
  // Handler
  handler: ToolHandler;
  
  // Metadata
  metadata?: {
    version?: string;
    author?: string;
    deprecated?: boolean;
    replacedBy?: string;
    examples?: ToolExample[];
  };
}

type ToolHandler = (params: any) => Promise<any>;

enum ToolCategory {
  FILE_SYSTEM = 'file_system',
  CODE_ANALYSIS = 'code_analysis',
  TESTING = 'testing',
  DIAGNOSTICS = 'diagnostics',
  SEARCH = 'search',
  REFACTORING = 'refactoring',
  GIT = 'git',
  UTILITY = 'utility'
}
```

### ParameterDefinition

```typescript
interface ParameterDefinition {
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description: string;
  
  // Validation
  enum?: any[];
  pattern?: string; // Regex
  minLength?: number;
  maxLength?: number;
  minimum?: number;
  maximum?: number;
  
  // Default value
  default?: any;
  
  // Nested schema (for object/array types)
  properties?: Record<string, ParameterDefinition>;
  items?: ParameterDefinition;
}
```

### ToolExample

```typescript
interface ToolExample {
  description: string;
  params: any;
  expectedResult?: any;
}
```

### ValidationResult

```typescript
interface ValidationResult {
  valid: boolean;
  errors?: ValidationError[];
}

interface ValidationError {
  param: string;
  message: string;
  code: string;
}
```

---

## Built-in Tools

### File System Tools

#### read_file

```typescript
const READ_FILE_TOOL: Tool = {
  name: 'read_file',
  description: 'Read content of a file',
  category: ToolCategory.FILE_SYSTEM,
  
  parameters: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Absolute or relative path to file'
      },
      encoding: {
        type: 'string',
        description: 'File encoding',
        enum: ['utf-8', 'ascii', 'base64'],
        default: 'utf-8'
      }
    },
    required: ['path']
  },
  
  handler: async (params: { path: string; encoding?: string }) => {
    const fs = require('fs').promises;
    const content = await fs.readFile(params.path, params.encoding || 'utf-8');
    
    return {
      path: params.path,
      content,
      size: content.length,
      encoding: params.encoding || 'utf-8'
    };
  },
  
  metadata: {
    examples: [
      {
        description: 'Read TypeScript file',
        params: { path: '/src/index.ts' },
        expectedResult: { content: '...', size: 1234 }
      }
    ]
  }
};
```

#### write_file

```typescript
const WRITE_FILE_TOOL: Tool = {
  name: 'write_file',
  description: 'Write content to a file',
  category: ToolCategory.FILE_SYSTEM,
  
  parameters: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Path to write to'
      },
      content: {
        type: 'string',
        description: 'Content to write'
      },
      createDirs: {
        type: 'boolean',
        description: 'Create parent directories if needed',
        default: true
      }
    },
    required: ['path', 'content']
  },
  
  handler: async (params: {
    path: string;
    content: string;
    createDirs?: boolean;
  }) => {
    const fs = require('fs').promises;
    const path = require('path');
    
    if (params.createDirs) {
      await fs.mkdir(path.dirname(params.path), { recursive: true });
    }
    
    await fs.writeFile(params.path, params.content, 'utf-8');
    
    return {
      path: params.path,
      bytesWritten: params.content.length,
      success: true
    };
  }
};
```

#### search_files

```typescript
const SEARCH_FILES_TOOL: Tool = {
  name: 'search_files',
  description: 'Search for files by pattern',
  category: ToolCategory.SEARCH,
  
  parameters: {
    type: 'object',
    properties: {
      pattern: {
        type: 'string',
        description: 'Glob pattern to match'
      },
      directory: {
        type: 'string',
        description: 'Directory to search in',
        default: '.'
      },
      ignore: {
        type: 'array',
        description: 'Patterns to ignore',
        items: { type: 'string' },
        default: ['node_modules', '.git', 'dist']
      },
      maxResults: {
        type: 'number',
        description: 'Maximum number of results',
        default: 100
      }
    },
    required: ['pattern']
  },
  
  handler: async (params: {
    pattern: string;
    directory?: string;
    ignore?: string[];
    maxResults?: number;
  }) => {
    const glob = require('glob');
    
    const files = await glob(params.pattern, {
      cwd: params.directory || '.',
      ignore: params.ignore || ['node_modules', '.git', 'dist']
    });
    
    const limited = files.slice(0, params.maxResults || 100);
    
    return {
      files: limited,
      totalFound: files.length,
      truncated: files.length > limited.length
    };
  }
};
```

---

### Code Analysis Tools

#### search_code

```typescript
const SEARCH_CODE_TOOL: Tool = {
  name: 'search_code',
  description: 'Search for code patterns in files',
  category: ToolCategory.CODE_ANALYSIS,
  
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search query (regex or plain text)'
      },
      files: {
        type: 'array',
        description: 'Files to search in',
        items: { type: 'string' }
      },
      regex: {
        type: 'boolean',
        description: 'Treat query as regex',
        default: false
      },
      caseInsensitive: {
        type: 'boolean',
        description: 'Case insensitive search',
        default: true
      },
      maxResults: {
        type: 'number',
        default: 50
      }
    },
    required: ['query']
  },
  
  handler: async (params: {
    query: string;
    files?: string[];
    regex?: boolean;
    caseInsensitive?: boolean;
    maxResults?: number;
  }) => {
    // Implementation using grep-like search
    const results: SearchResult[] = [];
    
    // ... search implementation
    
    return {
      query: params.query,
      matches: results,
      totalMatches: results.length
    };
  }
};

interface SearchResult {
  file: string;
  line: number;
  column: number;
  match: string;
  context: string;
}
```

#### get_diagnostics

```typescript
const GET_DIAGNOSTICS_TOOL: Tool = {
  name: 'get_diagnostics',
  description: 'Get TypeScript/ESLint diagnostics',
  category: ToolCategory.DIAGNOSTICS,
  
  parameters: {
    type: 'object',
    properties: {
      file: {
        type: 'string',
        description: 'File to get diagnostics for'
      },
      type: {
        type: 'string',
        description: 'Diagnostic type',
        enum: ['typescript', 'eslint', 'all'],
        default: 'all'
      }
    },
    required: ['file']
  },
  
  handler: async (params: {
    file: string;
    type?: 'typescript' | 'eslint' | 'all';
  }) => {
    // Get diagnostics from VS Code API
    const vscode = require('vscode');
    
    const uri = vscode.Uri.file(params.file);
    const diagnostics = vscode.languages.getDiagnostics(uri);
    
    return {
      file: params.file,
      diagnostics: diagnostics.map(d => ({
        severity: d.severity,
        message: d.message,
        line: d.range.start.line,
        column: d.range.start.character,
        source: d.source
      })),
      errorCount: diagnostics.filter(d => d.severity === 0).length,
      warningCount: diagnostics.filter(d => d.severity === 1).length
    };
  }
};
```

---

### Testing Tools

#### run_tests

```typescript
const RUN_TESTS_TOOL: Tool = {
  name: 'run_tests',
  description: 'Run tests using the project test framework',
  category: ToolCategory.TESTING,
  
  parameters: {
    type: 'object',
    properties: {
      scope: {
        type: 'string',
        description: 'Test scope',
        enum: ['all', 'affected', 'file'],
        default: 'all'
      },
      file: {
        type: 'string',
        description: 'Specific test file (if scope=file)'
      },
      watch: {
        type: 'boolean',
        description: 'Run in watch mode',
        default: false
      },
      coverage: {
        type: 'boolean',
        description: 'Generate coverage report',
        default: false
      }
    }
  },
  
  handler: async (params: {
    scope?: 'all' | 'affected' | 'file';
    file?: string;
    watch?: boolean;
    coverage?: boolean;
  }) => {
    // Detect test framework
    const framework = await detectTestFramework();
    
    // Run tests
    const result = await runTests(framework, params);
    
    return {
      framework,
      passed: result.passed,
      failed: result.failed,
      skipped: result.skipped,
      totalTime: result.totalTime,
      failedTests: result.failedTests.map(t => ({
        name: t.name,
        error: t.error,
        file: t.file
      })),
      coverage: params.coverage ? result.coverage : undefined
    };
  }
};
```

---

### Git Tools

#### git_status

```typescript
const GIT_STATUS_TOOL: Tool = {
  name: 'git_status',
  description: 'Get git repository status',
  category: ToolCategory.GIT,
  
  parameters: {
    type: 'object',
    properties: {
      directory: {
        type: 'string',
        description: 'Repository directory',
        default: '.'
      }
    }
  },
  
  handler: async (params: { directory?: string }) => {
    const simpleGit = require('simple-git');
    const git = simpleGit(params.directory || '.');
    
    const status = await git.status();
    
    return {
      branch: status.current,
      ahead: status.ahead,
      behind: status.behind,
      modified: status.modified,
      created: status.created,
      deleted: status.deleted,
      staged: status.staged,
      conflicted: status.conflicted
    };
  }
};
```

---

## Tool Manager Implementation

```typescript
class ToolManager implements IToolManager {
  private tools: Map<string, Tool> = new Map();
  
  constructor() {
    this.registerDefaultTools();
  }
  
  private registerDefaultTools(): void {
    // File System
    this.registerTool(READ_FILE_TOOL);
    this.registerTool(WRITE_FILE_TOOL);
    this.registerTool(SEARCH_FILES_TOOL);
    
    // Code Analysis
    this.registerTool(SEARCH_CODE_TOOL);
    this.registerTool(GET_DIAGNOSTICS_TOOL);
    
    // Testing
    this.registerTool(RUN_TESTS_TOOL);
    
    // Git
    this.registerTool(GIT_STATUS_TOOL);
  }
  
  async execute(toolName: string, params: any): Promise<any> {
    const tool = this.getTool(toolName);
    
    if (!tool) {
      throw new ToolNotFoundError(
        `Tool '${toolName}' not found`,
        { toolName, availableTools: Array.from(this.tools.keys()) }
      );
    }
    
    // Validate parameters
    const validation = this.validateParams(toolName, params);
    
    if (!validation.valid) {
      throw new ToolValidationError(
        `Invalid parameters for tool '${toolName}'`,
        { toolName, errors: validation.errors }
      );
    }
    
    try {
      // Execute tool
      const result = await tool.handler(params);
      
      return result;
      
    } catch (error) {
      throw new ToolExecutionError(
        `Tool '${toolName}' execution failed: ${(error as Error).message}`,
        { toolName, params, error }
      );
    }
  }
  
  registerTool(tool: Tool): void {
    if (this.tools.has(tool.name)) {
      console.warn(`Tool '${tool.name}' already registered, overwriting`);
    }
    
    this.tools.set(tool.name, tool);
  }
  
  unregisterTool(toolName: string): void {
    this.tools.delete(toolName);
  }
  
  getTool(toolName: string): Tool | undefined {
    return this.tools.get(toolName);
  }
  
  getTools(toolNames: string[]): Tool[] {
    return toolNames
      .map(name => this.getTool(name))
      .filter((tool): tool is Tool => tool !== undefined);
  }
  
  listTools(): Tool[] {
    return Array.from(this.tools.values());
  }
  
  getToolsByCategory(category: ToolCategory): Tool[] {
    return this.listTools().filter(tool => tool.category === category);
  }
  
  validateParams(toolName: string, params: any): ValidationResult {
    const tool = this.getTool(toolName);
    
    if (!tool) {
      return {
        valid: false,
        errors: [{
          param: 'tool',
          message: `Tool '${toolName}' not found`,
          code: 'TOOL_NOT_FOUND'
        }]
      };
    }
    
    const errors: ValidationError[] = [];
    
    // Check required params
    for (const required of tool.parameters.required || []) {
      if (!(required in params)) {
        errors.push({
          param: required,
          message: `Missing required parameter: ${required}`,
          code: 'MISSING_REQUIRED'
        });
      }
    }
    
    // Validate param types
    for (const [name, value] of Object.entries(params)) {
      const def = tool.parameters.properties[name];
      
      if (!def) {
        errors.push({
          param: name,
          message: `Unknown parameter: ${name}`,
          code: 'UNKNOWN_PARAM'
        });
        continue;
      }
      
      // Type check
      const actualType = typeof value;
      if (actualType !== def.type && value !== null && value !== undefined) {
        errors.push({
          param: name,
          message: `Expected type ${def.type}, got ${actualType}`,
          code: 'TYPE_MISMATCH'
        });
      }
      
      // Enum check
      if (def.enum && !def.enum.includes(value)) {
        errors.push({
          param: name,
          message: `Value must be one of: ${def.enum.join(', ')}`,
          code: 'INVALID_ENUM'
        });
      }
    }
    
    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined
    };
  }
}
```

---

## Error Handling

```typescript
class ToolNotFoundError extends Error {
  constructor(message: string, public context: any) {
    super(message);
  }
}

class ToolValidationError extends Error {
  constructor(message: string, public context: any) {
    super(message);
  }
}

class ToolExecutionError extends Error {
  constructor(message: string, public context: any) {
    super(message);
  }
}
```

---

## Usage Examples

### Example 1: Execute File Read

```typescript
const toolManager = new ToolManager();

const result = await toolManager.execute('read_file', {
  path: '/src/index.ts'
});

console.log(result.content);
```

### Example 2: Run Tests

```typescript
const result = await toolManager.execute('run_tests', {
  scope: 'affected',
  coverage: true
});

console.log(`Passed: ${result.passed}, Failed: ${result.failed}`);
```

### Example 3: Custom Tool

```typescript
const CUSTOM_TOOL: Tool = {
  name: 'format_code',
  description: 'Format code using Prettier',
  category: ToolCategory.REFACTORING,
  
  parameters: {
    type: 'object',
    properties: {
      code: {
        type: 'string',
        description: 'Code to format'
      },
      parser: {
        type: 'string',
        description: 'Parser to use',
        enum: ['typescript', 'babel', 'json'],
        default: 'typescript'
      }
    },
    required: ['code']
  },
  
  handler: async (params) => {
    const prettier = require('prettier');
    
    const formatted = prettier.format(params.code, {
      parser: params.parser || 'typescript'
    });
    
    return {
      formatted,
      changed: formatted !== params.code
    };
  }
};

toolManager.registerTool(CUSTOM_TOOL);

const result = await toolManager.execute('format_code', {
  code: 'function  add(  a,b  ){return a+b}',
  parser: 'typescript'
});

console.log(result.formatted);
```

---

## Dependencies

Tool Manager không depend vào managers khác - nó là leaf service.
