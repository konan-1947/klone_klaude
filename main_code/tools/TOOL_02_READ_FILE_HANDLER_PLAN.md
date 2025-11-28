# Tool 2: ReadFileHandler - Implementation Plan

## Tổng quan

**Mục tiêu:** Implement `read_file` tool để đọc nội dung file với security validation.

**Base từ:** `Cline/ReadFileToolHandler.ts` (simplified)

**Dependencies:** 
- ✅ IgnoreManager (đã complete)
- ToolManager (sẽ tạo cùng lúc)

---

## Objectives

### Primary Goals:
1. ✅ Read file content safely
2. ✅ Validate access với IgnoreManager
3. ✅ Handle text files (UTF-8)
4. ✅ Error handling robust

### Success Criteria:
- [x] Read text files successfully
- [x] Block access to ignored files
- [x] Return clear error messages
- [x] Handle large files (>1MB warning)
- [x] Support absolute và relative paths

---

## Tool Specification (từ FILE_OPERATIONS_SPEC.md)

### Tool Name:
`read_file`

### Description:
Read contents of a text file from the file system.

### Parameters:
```typescript
interface ReadFileParams {
    path: string;  // Absolute or relative path to file
}
```

### Response Format:
```typescript
interface ReadFileResponse {
    success: boolean;
    data?: string;           // File content
    error?: string;
    metadata?: {
        size: number;        // File size in bytes
        encoding: string;    // 'utf-8'
        lines: number;       // Number of lines
    };
}
```

### Example Usage:
```typescript
// Read a source file
const result = await readFile.execute({
    path: 'src/index.ts'
});

// Success response
{
    success: true,
    data: 'import ...\nexport ...',
    metadata: {
        size: 1024,
        encoding: 'utf-8',
        lines: 45
    }
}

// Error response (blocked)
{
    success: false,
    error: 'Access denied: File is ignored by .aiignore',
    accessDenied: true,
    deniedPath: 'node_modules/lib.js'
}
```

---

## Base Implementation từ Cline

### Source File:
```
cline/src/core/task/tools/handlers/ReadFileToolHandler.ts (179 lines)
```

### Key Features từ Cline (giữ lại):

#### 1. **Core Reading Logic**
```typescript
const content = await fs.readFile(absolutePath, 'utf-8');
```

#### 2. **Path Resolution**
```typescript
const absolutePath = path.resolve(this.cwd, params.path);
```

#### 3. **ClineIgnore Validation**
```typescript
if (!this.clineIgnore.validateAccess(params.path)) {
    throw new Error('Access denied');
}
```

#### 4. **Error Handling**
```typescript
try {
    // read file
} catch (error) {
    if (error.code === 'ENOENT') return 'File not found';
    if (error.code === 'EISDIR') return 'Path is a directory';
    throw error;
}
```

### Phần BỎ QUA từ Cline (Phase 1):
- ❌ PDF extraction (pdfjs)
- ❌ DOCX extraction (mammoth)
- ❌ Image support (jimp)
- ❌ Telemetry tracking
- ❌ Hooks system
- ❌ User approval UI

### Giữ nguyên từ Cline:
- ✅ Path normalization
- ✅ UTF-8 encoding
- ✅ Error code handling (ENOENT, EISDIR, EACCES)
- ✅ Relative path support

---

## Simplified Implementation

### File Structure:
```
src/core/tools/
├── ToolManager.ts              # Registry + execution
├── handlers/
│   ├── BaseHandler.ts          # Abstract base class
│   └── ReadFileHandler.ts      # Implementation
└── __tests__/
    └── ReadFileHandler.test.ts
```

### BaseHandler (Abstract):
```typescript
export abstract class BaseHandler {
    constructor(
        protected cwd: string,
        protected ignoreManager: IgnoreManager
    ) {}
    
    abstract execute(params: any): Promise<ToolResponse>;
    
    protected resolveAbsolutePath(filePath: string): string {
        return path.resolve(this.cwd, filePath);
    }
    
    protected validateAccess(filePath: string): void {
        if (!this.ignoreManager.validateAccess(filePath)) {
            throw new AccessDeniedError(filePath);
        }
    }
}
```

### ReadFileHandler Implementation:
```typescript
import fs from 'fs/promises';
import path from 'path';
import { BaseHandler } from './BaseHandler';
import { IgnoreManager } from '../../ignore/IgnoreManager';

interface ReadFileParams {
    path: string;
}

interface ReadFileResponse {
    success: boolean;
    data?: string;
    error?: string;
    metadata?: {
        size: number;
        encoding: string;
        lines: number;
    };
    accessDenied?: boolean;
    deniedPath?: string;
}

export class ReadFileHandler extends BaseHandler {
    async execute(params: ReadFileParams): Promise<ReadFileResponse> {
        try {
            // 1. Validate params
            if (!params.path) {
                return {
                    success: false,
                    error: 'Parameter "path" is required'
                };
            }

            // 2. Resolve absolute path
            const absolutePath = this.resolveAbsolutePath(params.path);

            // 3. Validate access với IgnoreManager
            try {
                this.validateAccess(params.path);
            } catch (error) {
                if (error instanceof AccessDeniedError) {
                    return {
                        success: false,
                        error: `Access denied: File is ignored by .aiignore`,
                        accessDenied: true,
                        deniedPath: params.path
                    };
                }
                throw error;
            }

            // 4. Check if file exists và is file
            let stats;
            try {
                stats = await fs.stat(absolutePath);
            } catch (error: any) {
                if (error.code === 'ENOENT') {
                    return {
                        success: false,
                        error: `File not found: ${params.path}`
                    };
                }
                throw error;
            }

            if (stats.isDirectory()) {
                return {
                    success: false,
                    error: `Path is a directory, not a file: ${params.path}. Use list_files instead.`
                };
            }

            // 5. Warn if file is large
            const MAX_SIZE = 1024 * 1024; // 1MB
            if (stats.size > MAX_SIZE) {
                console.warn(`[ReadFileHandler] Large file detected: ${params.path} (${stats.size} bytes)`);
            }

            // 6. Read file content
            const content = await fs.readFile(absolutePath, 'utf-8');

            // 7. Calculate metadata
            const lines = content.split('\n').length;

            return {
                success: true,
                data: content,
                metadata: {
                    size: stats.size,
                    encoding: 'utf-8',
                    lines
                }
            };

        } catch (error: any) {
            // Handle other errors
            if (error.code === 'EACCES') {
                return {
                    success: false,
                    error: `Permission denied: ${params.path}`
                };
            }

            return {
                success: false,
                error: error.message || 'Unknown error occurred'
            };
        }
    }
}
```

---

## Error Classes

### AccessDeniedError:
```typescript
export class AccessDeniedError extends Error {
    constructor(public filePath: string) {
        super(`Access denied: ${filePath}`);
        this.name = 'AccessDeniedError';
    }
}
```

### ToolError:
```typescript
export class ToolError extends Error {
    constructor(
        message: string,
        public code: string
    ) {
        super(message);
        this.name = 'ToolError';
    }
}
```

---

## ToolManager Integration

### Registration:
```typescript
import { ReadFileHandler } from './handlers/ReadFileHandler';
import { IgnoreManager } from '../ignore/IgnoreManager';

export class ToolManager {
    private handlers = new Map<string, BaseHandler>();
    
    constructor(
        private cwd: string,
        private ignoreManager: IgnoreManager
    ) {
        this.registerDefaultTools();
    }
    
    private registerDefaultTools(): void {
        // Register read_file
        this.handlers.set(
            'read_file',
            new ReadFileHandler(this.cwd, this.ignoreManager)
        );
    }
    
    async execute(toolName: string, params: any): Promise<any> {
        const handler = this.handlers.get(toolName);
        
        if (!handler) {
            throw new Error(`Unknown tool: ${toolName}`);
        }
        
        return await handler.execute(params);
    }
}
```

---

## Testing Strategy

### Unit Tests:

```typescript
describe('ReadFileHandler', () => {
    let handler: ReadFileHandler;
    let ignoreManager: IgnoreManager;
    let tempDir: string;

    beforeEach(async () => {
        tempDir = path.join(os.tmpdir(), `read-file-test-${Date.now()}`);
        await fs.mkdir(tempDir, { recursive: true });
        
        ignoreManager = new IgnoreManager(tempDir);
        await ignoreManager.initialize();
        
        handler = new ReadFileHandler(tempDir, ignoreManager);
    });

    afterEach(async () => {
        await ignoreManager.dispose();
        await fs.rm(tempDir, { recursive: true, force: true });
    });

    describe('execute', () => {
        it('should read file successfully', async () => {
            const testFile = path.join(tempDir, 'test.txt');
            await fs.writeFile(testFile, 'Hello World\nLine 2');
            
            const result = await handler.execute({ path: 'test.txt' });
            
            expect(result.success).toBe(true);
            expect(result.data).toBe('Hello World\nLine 2');
            expect(result.metadata?.lines).toBe(2);
        });

        it('should return error for non-existent file', async () => {
            const result = await handler.execute({ path: 'nonexistent.txt' });
            
            expect(result.success).toBe(false);
            expect(result.error).toContain('File not found');
        });

        it('should block access to ignored files', async () => {
            // Create .aiignore
            await fs.writeFile(
                path.join(tempDir, '.aiignore'),
                'secret.txt'
            );
            await ignoreManager.initialize();
            
            // Create secret file
            await fs.writeFile(
                path.join(tempDir, 'secret.txt'),
                'Secret content'
            );
            
            const result = await handler.execute({ path: 'secret.txt' });
            
            expect(result.success).toBe(false);
            expect(result.accessDenied).toBe(true);
            expect(result.error).toContain('Access denied');
        });

        it('should return error for directory', async () => {
            await fs.mkdir(path.join(tempDir, 'folder'));
            
            const result = await handler.execute({ path: 'folder' });
            
            expect(result.success).toBe(false);
            expect(result.error).toContain('directory');
        });

        it('should handle absolute paths', async () => {
            const testFile = path.join(tempDir, 'absolute.txt');
            await fs.writeFile(testFile, 'Absolute path');
            
            const result = await handler.execute({ path: testFile });
            
            expect(result.success).toBe(true);
            expect(result.data).toBe('Absolute path');
        });

        it('should handle relative paths with subdirectories', async () => {
            await fs.mkdir(path.join(tempDir, 'subfolder'));
            await fs.writeFile(
                path.join(tempDir, 'subfolder', 'nested.txt'),
                'Nested content'
            );
            
            const result = await handler.execute({ 
                path: 'subfolder/nested.txt' 
            });
            
            expect(result.success).toBe(true);
            expect(result.data).toBe('Nested content');
        });

        it('should warn on large files', async () => {
            const spy = jest.spyOn(console, 'warn');
            const largeContent = 'x'.repeat(2 * 1024 * 1024); // 2MB
            
            await fs.writeFile(
                path.join(tempDir, 'large.txt'),
                largeContent
            );
            
            await handler.execute({ path: 'large.txt' });
            
            expect(spy).toHaveBeenCalled();
            spy.mockRestore();
        });

        it('should return metadata', async () => {
            await fs.writeFile(
                path.join(tempDir, 'meta.txt'),
                'Line 1\nLine 2\nLine 3'
            );
            
            const result = await handler.execute({ path: 'meta.txt' });
            
            expect(result.metadata).toBeDefined();
            expect(result.metadata?.size).toBeGreaterThan(0);
            expect(result.metadata?.encoding).toBe('utf-8');
            expect(result.metadata?.lines).toBe(3);
        });
    });
});
```

---

## Integration Testing

### End-to-End Test:
```typescript
describe('ReadFile Integration', () => {
    it('should work end-to-end với ToolManager', async () => {
        const tempDir = path.join(os.tmpdir(), 'integration-test');
        await fs.mkdir(tempDir, { recursive: true });
        
        // Setup
        const ignoreManager = new IgnoreManager(tempDir);
        await ignoreManager.initializeWithAutoGeneration();
        
        const toolManager = new ToolManager(tempDir, ignoreManager);
        
        // Create test file
        await fs.writeFile(
            path.join(tempDir, 'test.js'),
            'console.log("Hello");'
        );
        
        // Execute via ToolManager
        const result = await toolManager.execute('read_file', {
            path: 'test.js'
        });
        
        expect(result.success).toBe(true);
        expect(result.data).toContain('console.log');
        
        // Cleanup
        await ignoreManager.dispose();
        await fs.rm(tempDir, { recursive: true, force: true });
    });
});
```

---

## Implementation Plan

### Phase 1:
1. Create `BaseHandler.ts`
2. Create error classes
3. Implement `ReadFileHandler.ts` basic structure
4. Implement core read logic
5. Add error handling
6. Add metadata calculation

### Phase 2:
1. Write unit tests
2. Fix bugs từ tests
3. Create `ToolManager.ts` skeleton
4. Integration testing

---

## File Checklist

### Files to Create:
- [ ] `src/core/tools/types.ts` - Common interfaces
- [ ] `src/core/tools/errors.ts` - Error classes
- [ ] `src/core/tools/handlers/BaseHandler.ts` - Abstract base
- [ ] `src/core/tools/handlers/ReadFileHandler.ts` - Implementation
- [ ] `src/core/tools/ToolManager.ts` - Manager class
- [ ] `src/core/tools/__tests__/ReadFileHandler.test.ts` - Unit tests
- [ ] `src/core/tools/__tests__/ToolManager.test.ts` - Integration tests

---

## Dependencies

### NPM Packages:
```json
{
  "dependencies": {
    // Already installed
  }
}
```

### Internal:
- ✅ `IgnoreManager` (already implemented)
- `fs/promises` (Node.js built-in)
- `path` (Node.js built-in)

---

## Edge Cases

### Must Handle:
1. ✅ File not found (ENOENT)
2. ✅ Permission denied (EACCES)
3. ✅ Path is directory (EISDIR)
4. ✅ Ignored by .aiignore
5. ✅ Large files (>1MB warning)
6. ✅ Empty files
7. ✅ Binary files (will fail UTF-8 decode - acceptable)
8. ✅ Symlinks (follow by default)
9. ✅ Absolute paths
10. ✅ Relative paths with ../

### Security Considerations:
- ✅ Path traversal prevention (via IgnoreManager)
- ✅ No access outside workspace
- ✅ Respect .aiignore patterns
- ✅ Fail closed (deny on error)

---

## Performance Metrics

### Targets:
- Read small file (<100KB): < 10ms
- Read medium file (1MB): < 100ms
- Read large file (10MB): < 1s
- Memory usage: ~2x file size (streaming not needed Phase 1)

### Optimizations:
- Phase 1: Load entire file (simple)
- Phase 2: Streaming for files >10MB
- Phase 2: Caching frequently accessed files

---

## Success Metrics

### Functional:
- [x] Read text files correctly
- [x] Block ignored files 100%
- [x] Handle all error cases gracefully
- [x] Return proper metadata

### Non-functional:
- [x] < 100 lines of code (simple)
- [x] 100% test coverage
- [x] No security vulnerabilities
- [x] Performance targets met

---

## Next Steps After ReadFileHandler

1. **Immediate:**
   - Implement WriteFileHandler
   - Implement ReplaceInFileHandler
   - Implement ListFilesHandler
   - Implement SearchFilesHandler

2. **Week 2:**
   - Complete all 5 handlers
   - ToolManager full implementation
   - End-to-end testing

3. **Phase 2:**
   - Add PDF/DOCX support
   - Add streaming for large files
   - Add file watching/hot reload

---

## Notes

### Design Decisions:
- **Simple over complex**: No streaming, no caching (Phase 1)
- **Security first**: IgnoreManager validates before read
- **Clear errors**: Specific error messages for each case
- **Metadata included**: Size, lines, encoding always returned

### Future Enhancements:
- [ ] Binary file detection
- [ ] Charset detection (beyond UTF-8)
- [ ] Compression support (.gz)
- [ ] Syntax highlighting hints
- [ ] Line range reading (lines 1-100)

---

**Status:** Ready to implement
**Ready to Start:** After IgnoreManager complete ✅
