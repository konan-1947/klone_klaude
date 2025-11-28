# Optimized PTK Manager Implementation Plan

## Overview

Tạo **OptimizedPTKManager** để giảm số lần gọi AI Studio bằng cách:
1. Sử dụng Groq (fast, cheap AI) để preprocessing và chọn files
2. Đọc files locally
3. Gọi AI Studio **CHỈ 1 LẦN** với full context

**Vẫn giữ interface IPTKManager** để dễ dàng switch giữa Standard và Optimized mode.

---

## Architecture Comparison

### Standard PTK (Hiện tại)
```
User: "Đọc package.json và cho tôi version"
    ↓
AI Studio Call #1: "Cần tool gì?" → read_file(package.json)
    ↓
Read file locally
    ↓
AI Studio Call #2: "Analyze content" → Answer
    ↓
Total: 2 AI Studio calls (SLOW)
```

### Optimized PTK (Mới)
```
User: "Đọc package.json và cho tôi version"
    ↓
Build workspace context (local)
    ↓
Groq Call: "Files nào cần?" → ["package.json"]
    ↓
Read files locally
    ↓
AI Studio Call #1 (ONLY): "Here's context + files, answer" → Answer
    ↓
Total: 1 AI Studio call (FAST)
```

---

## Components Architecture

```
src/core/
├── ptk/
│   ├── IPTKManager.ts              # ✅ Đã có (cần extract interface)
│   ├── StandardPTKManager.ts       # Rename từ PTKManager.ts
│   ├── OptimizedPTKManager.ts      # ❌ Mới - Main implementation
│   └── PTKManagerFactory.ts        # ❌ Mới - Factory pattern
│
├── context/
│   ├── ContextBuilder.ts           # ❌ Mới - Build workspace tree
│   └── types.ts                    # ❌ Mới - Context types
│
├── llm/
│   ├── providers/
│   │   ├── GroqLLMProvider.ts      # ❌ Mới - Groq integration
│   │   └── AIStudioLLMProvider.ts  # ✅ Đã có
│   └── LLMManager.ts               # ✅ Đã có
│
└── tools/
    ├── ToolManager.ts              # ✅ Đã có
    └── BatchFileReader.ts          # ❌ Mới - Read multiple files efficiently
```

---

## Phase 1: Extract Interface

### File: `src/core/ptk/IPTKManager.ts`

```typescript
/**
 * PTK Manager Interface
 * Common interface for Standard and Optimized PTK implementations
 */

import { PTKExecuteOptions, PTKExecuteResult } from './types';

export interface IPTKManager {
    /**
     * Orchestrate tool calling workflow
     * @param prompt - User prompt
     * @param options - Execution options
     * @returns Result with answer and metadata
     */
    orchestrateToolCalling(
        prompt: string,
        options?: PTKExecuteOptions
    ): Promise<PTKExecuteResult>;
}
```

### File: Rename `PTKManager.ts` → `StandardPTKManager.ts`

```typescript
/**
 * Standard PTK Manager - Multi-iteration tool calling
 */

import { IPTKManager } from './IPTKManager';

export class StandardPTKManager implements IPTKManager {
    // Existing implementation
    // Just rename class, keep all logic
}
```

---

## Phase 2: Context Builder

### File: `src/core/context/types.ts`

```typescript
/**
 * Workspace context types
 */

export interface WorkspaceContext {
    // File tree
    tree: FileTreeNode;
    
    // Statistics
    stats: {
        totalFiles: number;
        totalDirs: number;
        languages: Record<string, number>; // e.g., {"ts": 50, "json": 10}
    };
    
    // Summary
    summary: string; // Human-readable summary
}

export interface FileTreeNode {
    name: string;
    type: 'file' | 'directory';
    path: string;
    children?: FileTreeNode[];
    size?: number;
}

export interface ContextBuildOptions {
    maxDepth?: number;       // Default: 3
    includeIgnored?: boolean; // Default: false
    format?: 'tree' | 'list'; // Default: 'tree'
}
```

### File: `src/core/context/ContextBuilder.ts`

```typescript
/**
 * Context Builder - Build workspace context for AI
 */

import { IgnoreManager } from '../ignore/IgnoreManager';
import { WorkspaceContext, FileTreeNode, ContextBuildOptions } from './types';
import fs from 'fs/promises';
import path from 'path';

export class ContextBuilder {
    constructor(
        private workspacePath: string,
        private ignoreManager: IgnoreManager
    ) {}
    
    /**
     * Build workspace context
     */
    async buildContext(options: ContextBuildOptions = {}): Promise<WorkspaceContext> {
        const {
            maxDepth = 3,
            includeIgnored = false,
            format = 'tree'
        } = options;
        
        // 1. Scan workspace để build tree
        const tree = await this.buildTree(this.workspacePath, 0, maxDepth, includeIgnored);
        
        // 2. Calculate statistics
        const stats = this.calculateStats(tree);
        
        // 3. Generate summary
        const summary = this.generateSummary(tree, stats);
        
        return {
            tree,
            stats,
            summary
        };
    }
    
    /**
     * Build file tree recursively
     */
    private async buildTree(
        dirPath: string,
        currentDepth: number,
        maxDepth: number,
        includeIgnored: boolean
    ): Promise<FileTreeNode> {
        const name = path.basename(dirPath);
        
        // Check if ignored
        const relativePath = path.relative(this.workspacePath, dirPath);
        if (!includeIgnored && !this.ignoreManager.validateAccess(relativePath)) {
            return {
                name,
                type: 'directory',
                path: relativePath,
                children: []
            };
        }
        
        const stats = await fs.stat(dirPath);
        
        if (stats.isFile()) {
            return {
                name,
                type: 'file',
                path: relativePath,
                size: stats.size
            };
        }
        
        // Directory
        if (currentDepth >= maxDepth) {
            return {
                name,
                type: 'directory',
                path: relativePath,
                children: []
            };
        }
        
        const entries = await fs.readdir(dirPath);
        const children: FileTreeNode[] = [];
        
        for (const entry of entries) {
            const fullPath = path.join(dirPath, entry);
            const child = await this.buildTree(fullPath, currentDepth + 1, maxDepth, includeIgnored);
            children.push(child);
        }
        
        return {
            name,
            type: 'directory',
            path: relativePath,
            children
        };
    }
    
    /**
     * Calculate workspace statistics
     */
    private calculateStats(tree: FileTreeNode): WorkspaceContext['stats'] {
        const stats = {
            totalFiles: 0,
            totalDirs: 0,
            languages: {} as Record<string, number>
        };
        
        const traverse = (node: FileTreeNode) => {
            if (node.type === 'file') {
                stats.totalFiles++;
                
                // Count by extension
                const ext = path.extname(node.name).slice(1);
                if (ext) {
                    stats.languages[ext] = (stats.languages[ext] || 0) + 1;
                }
            } else {
                stats.totalDirs++;
                node.children?.forEach(traverse);
            }
        };
        
        traverse(tree);
        return stats;
    }
    
    /**
     * Generate human-readable summary
     */
    private generateSummary(tree: FileTreeNode, stats: WorkspaceContext['stats']): string {
        const lines = [
            `Workspace: ${tree.name}`,
            `Files: ${stats.totalFiles}`,
            `Directories: ${stats.totalDirs}`,
            ``,
            `Languages:`,
            ...Object.entries(stats.languages)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5)
                .map(([ext, count]) => `  - ${ext}: ${count} files`)
        ];
        
        return lines.join('\n');
    }
    
    /**
     * Format tree as string (for AI prompt)
     */
    formatTree(tree: FileTreeNode, indent: string = ''): string {
        const lines: string[] = [];
        
        const isLast = true; // Simplified
        const prefix = indent + (isLast ? '└── ' : '├── ');
        
        lines.push(prefix + tree.name);
        
        if (tree.children) {
            const childIndent = indent + (isLast ? '    ' : '│   ');
            for (const child of tree.children) {
                lines.push(this.formatTree(child, childIndent));
            }
        }
        
        return lines.join('\n');
    }
}
```

---

## Phase 3: Groq LLM Provider

### File: `src/core/llm/providers/GroqLLMProvider.ts`

```typescript
/**
 * Groq LLM Provider - Fast, cheap AI for preprocessing
 */

import { ILLMManager } from '../ILLMManager';
import { LLMOptions } from '../../ptk/types';

export interface GroqConfig {
    apiKey: string;
    model?: string; // Default: 'mixtral-8x7b-32768'
    baseURL?: string;
}

export class GroqLLMProvider implements ILLMManager {
    private apiKey: string;
    private model: string;
    private baseURL: string;
    
    constructor(config: GroqConfig) {
        this.apiKey = config.apiKey;
        this.model = config.model || 'mixtral-8x7b-32768';
        this.baseURL = config.baseURL || 'https://api.groq.com/openai/v1';
    }
    
    async call(prompt: string, options?: LLMOptions): Promise<string> {
        const response = await fetch(`${this.baseURL}/chat/completions`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: options?.model || this.model,
                messages: [
                    { role: 'user', content: prompt }
                ],
                temperature: options?.temperature || 0.1,
                max_tokens: options?.maxTokens || 1000
            })
        });
        
        if (!response.ok) {
            throw new Error(`Groq API error: ${response.statusText}`);
        }
        
        const data = await response.json();
        return data.choices[0].message.content;
    }
}
```

**Note:** Groq API tương thích với OpenAI API format.

---

## Phase 4: Batch File Reader

### File: `src/core/tools/BatchFileReader.ts`

```typescript
/**
 * Batch File Reader - Read multiple files efficiently
 */

import { ToolManager } from './ToolManager';

export interface FileContent {
    path: string;
    content: string;
    success: boolean;
    error?: string;
}

export class BatchFileReader {
    constructor(private toolManager: ToolManager) {}
    
    /**
     * Read multiple files at once
     */
    async readFiles(paths: string[]): Promise<FileContent[]> {
        const results = await Promise.all(
            paths.map(async (path) => {
                try {
                    const result = await this.toolManager.execute('read_file', { path });
                    
                    if (result.success) {
                        return {
                            path,
                            content: result.data,
                            success: true
                        };
                    } else {
                        return {
                            path,
                            content: '',
                            success: false,
                            error: result.error
                        };
                    }
                } catch (error: any) {
                    return {
                        path,
                        content: '',
                        success: false,
                        error: error.message
                    };
                }
            })
        );
        
        return results;
    }
    
    /**
     * Format file contents for AI prompt
     */
    formatForPrompt(files: FileContent[]): string {
        return files
            .filter(f => f.success)
            .map(f => {
                return `### File: ${f.path}\n\`\`\`\n${f.content}\n\`\`\``;
            })
            .join('\n\n');
    }
}
```

---

## Phase 5: Optimized PTK Manager

### File: `src/core/ptk/OptimizedPTKManager.ts`

```typescript
/**
 * Optimized PTK Manager - Single AI Studio call with Groq preprocessing
 */

import { IPTKManager } from './IPTKManager';
import { PTKExecuteOptions, PTKExecuteResult, PTKToolCall } from './types';
import { ContextBuilder } from '../context/ContextBuilder';
import { BatchFileReader } from '../tools/BatchFileReader';
import { LLMManager } from '../llm/LLMManager';

export class OptimizedPTKManager implements IPTKManager {
    constructor(
        private contextBuilder: ContextBuilder,
        private groqManager: LLMManager,      // LLM Manager với Groq provider
        private aiStudioManager: LLMManager,  // LLM Manager với AI Studio provider
        private batchReader: BatchFileReader
    ) {}
    
    async orchestrateToolCalling(
        prompt: string,
        options: PTKExecuteOptions = {}
    ): Promise<PTKExecuteResult> {
        const startTime = Date.now();
        const toolCalls: PTKToolCall[] = [];
        
        try {
            // Step 1: Build workspace context
            const context = await this.contextBuilder.buildContext({
                maxDepth: 3,
                includeIgnored: false
            });
            
            const treeView = this.contextBuilder.formatTree(context.tree);
            
            // Step 2: Groq preprocessing - chọn files cần đọc
            const groqPrompt = this.buildGroqPrompt(prompt, context.summary, treeView);
            const groqResponse = await this.groqManager.call(groqPrompt, {
                temperature: 0.1
            });
            
            const filesToRead = this.parseFileList(groqResponse);
            
            // Record tool calls
            filesToRead.forEach(path => {
                toolCalls.push({
                    tool: 'read_file',
                    args: { path },
                    reasoning: 'Selected by Groq preprocessing'
                });
            });
            
            // Step 3: Read files locally (batch)
            const fileContents = await this.batchReader.readFiles(filesToRead);
            
            // Check if any file failed
            const failedFiles = fileContents.filter(f => !f.success);
            if (failedFiles.length > 0) {
                return {
                    success: false,
                    content: '',
                    error: `Failed to read files: ${failedFiles.map(f => f.path).join(', ')}`,
                    iterations: 1,
                    messages: [],
                    toolCalls,
                    totalToolCalls: filesToRead.length,
                    duration: Date.now() - startTime
                };
            }
            
            // Step 4: Single AI Studio call với full context
            const aiStudioPrompt = this.buildAIStudioPrompt(
                prompt,
                context.summary,
                this.batchReader.formatForPrompt(fileContents)
            );
            
            const answer = await this.aiStudioManager.call(aiStudioPrompt, {
                model: options.model,
                temperature: options.temperature || 0.7
            });
            
            // Success!
            return {
                success: true,
                content: answer,
                iterations: 1,  // Only 1 AI Studio call!
                messages: [],
                toolCalls,
                totalToolCalls: filesToRead.length,
                duration: Date.now() - startTime
            };
            
        } catch (error: any) {
            return {
                success: false,
                content: '',
                error: error.message || 'Unknown error occurred',
                iterations: 1,
                messages: [],
                toolCalls,
                totalToolCalls: toolCalls.length,
                duration: Date.now() - startTime
            };
        }
    }
    
    /**
     * Build prompt for Groq (file selection)
     */
    private buildGroqPrompt(userPrompt: string, summary: string, tree: string): string {
        return `You are a file selector AI. Analyze the user's question and workspace structure to determine which files need to be read.

Workspace Summary:
${summary}

Workspace Structure:
${tree}

User Question:
${userPrompt}

Task: Return a JSON array of file paths that need to be read to answer the question.

Output format (JSON only, no explanation):
{
  "files": ["path/to/file1.ts", "path/to/file2.json"]
}

Rules:
- Only return files that DIRECTLY help answer the question
- Use relative paths from workspace root
- Maximum 5 files
- If no files needed, return empty array
- NO markdown, ONLY JSON`;
    }
    
    /**
     * Parse file list from Groq response
     */
    private parseFileList(response: string): string[] {
        try {
            // Remove markdown code blocks if present
            const cleaned = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
            const parsed = JSON.parse(cleaned);
            return parsed.files || [];
        } catch (error) {
            console.error('Failed to parse Groq response:', response);
            return [];
        }
    }
    
    /**
     * Build final prompt for AI Studio
     */
    private buildAIStudioPrompt(
        userPrompt: string,
        summary: string,
        fileContents: string
    ): string {
        return `You are a helpful AI assistant with access to the user's workspace.

Workspace Summary:
${summary}

Relevant Files:
${fileContents}

User Question:
${userPrompt}

Task: Answer the user's question based on the provided workspace context and file contents. Be concise and accurate.`;
    }
}
```

---

## Phase 6: PTK Manager Factory

### File: `src/core/ptk/PTKManagerFactory.ts`

```typescript
/**
 * PTK Manager Factory - Create appropriate PTK Manager
 */

import { IPTKManager } from './IPTKManager';
import { StandardPTKManager } from './StandardPTKManager';
import { OptimizedPTKManager } from './OptimizedPTKManager';
import { LLMManager } from '../llm/LLMManager';
import { ToolRegistry } from '../tools/ToolRegistry';
import { ToolManager } from '../tools/ToolManager';
import { ContextManager } from '../context/ContextManager';
import { ContextBuilder } from '../context/ContextBuilder';
import { BatchFileReader } from '../tools/BatchFileReader';
import { IgnoreManager } from '../ignore/IgnoreManager';

export enum PTKMode {
    STANDARD = 'standard',
    OPTIMIZED = 'optimized'
}

export interface PTKFactoryOptions {
    mode: PTKMode;
    workspacePath: string;
    ignoreManager: IgnoreManager;
    llmManager: LLMManager;
    groqManager?: LLMManager; // Required for optimized mode
}

export class PTKManagerFactory {
    static create(options: PTKFactoryOptions): IPTKManager {
        const {
            mode,
            workspacePath,
            ignoreManager,
            llmManager,
            groqManager
        } = options;
        
        if (mode === PTKMode.STANDARD) {
            // Standard PTK
            const toolManager = new ToolManager(workspacePath, ignoreManager);
            const toolRegistry = new ToolRegistry(toolManager);
            const contextManager = new ContextManager();
            
            return new StandardPTKManager(
                llmManager,
                toolRegistry,
                contextManager
            );
        }
        
        if (mode === PTKMode.OPTIMIZED) {
            // Optimized PTK
            if (!groqManager) {
                throw new Error('Groq manager required for optimized mode');
            }
            
            const toolManager = new ToolManager(workspacePath, ignoreManager);
            const contextBuilder = new ContextBuilder(workspacePath, ignoreManager);
            const batchReader = new BatchFileReader(toolManager);
            
            return new OptimizedPTKManager(
                contextBuilder,
                groqManager,
                llmManager,
                batchReader
            );
        }
        
        throw new Error(`Unknown PTK mode: ${mode}`);
    }
}
```

---

## Phase 7: Update ChatViewProvider

### File: `src/providers/chat/ChatViewProvider.ts`

```typescript
import { PTKManagerFactory, PTKMode } from '../../core/ptk/PTKManagerFactory';
import { GroqLLMProvider } from '../../core/llm/providers/GroqLLMProvider';

export class ChatViewProvider implements vscode.WebviewViewProvider {
    // ...existing code...
    
    private async initializePTK(): Promise<void> {
        if (this.ptkManager) {
            return;
        }
        
        const workspacePath = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
        if (!workspacePath || !this.aiStudioBrowser) {
            return;
        }
        
        // Initialize IgnoreManager
        const ignoreManager = new IgnoreManager(workspacePath);
        await ignoreManager.initialize();
        
        // Initialize LLM Managers
        const aiStudioManager = new LLMManager();
        const aiStudioProvider = new AIStudioLLMProvider(this.aiStudioBrowser);
        aiStudioManager.registerProvider('ai-studio', aiStudioProvider);
        
        // Initialize Groq Manager (for optimized mode)
        const groqManager = new LLMManager();
        const groqApiKey = this.getGroqApiKey(); // From settings
        if (groqApiKey) {
            const groqProvider = new GroqLLMProvider({ apiKey: groqApiKey });
            groqManager.registerProvider('groq', groqProvider);
        }
        
        // Get PTK mode from settings
        const mode = this.getPTKMode(); // 'standard' or 'optimized'
        
        // Create PTK Manager using factory
        this.ptkManager = PTKManagerFactory.create({
            mode,
            workspacePath,
            ignoreManager,
            llmManager: aiStudioManager,
            groqManager: groqApiKey ? groqManager : undefined
        });
    }
    
    private getPTKMode(): PTKMode {
        const config = vscode.workspace.getConfiguration('ai-agent');
        const mode = config.get<string>('ptkMode', 'optimized');
        return mode === 'standard' ? PTKMode.STANDARD : PTKMode.OPTIMIZED;
    }
    
    private getGroqApiKey(): string | undefined {
        const config = vscode.workspace.getConfiguration('ai-agent');
        return config.get<string>('groqApiKey');
    }
}
```

---

## Phase 8: Configuration

### Update: `package.json`

```json
{
  "contributes": {
    "configuration": {
      "title": "AI Agent",
      "properties": {
        "ai-agent.ptkMode": {
          "type": "string",
          "enum": ["standard", "optimized"],
          "default": "optimized",
          "description": "PTK execution mode: standard (multi-iteration) or optimized (single AI call)"
        },
        "ai-agent.groqApiKey": {
          "type": "string",
          "default": "",
          "description": "Groq API key for optimized mode (get from https://console.groq.com)"
        }
      }
    }
  }
}
```

---

## Implementation Checklist

### Phase 1: Interface & Refactor
- [ ] Extract `IPTKManager` interface
- [ ] Rename `PTKManager` → `StandardPTKManager`
- [ ] Update imports

### Phase 2: Context Builder
- [ ] Create `src/core/context/types.ts`
- [ ] Create `src/core/context/ContextBuilder.ts`
- [ ] Test context building

### Phase 3: Groq Integration
- [ ] Create `GroqLLMProvider`
- [ ] Test Groq API calls
- [ ] Handle errors

### Phase 4: Batch Reader
- [ ] Create `BatchFileReader`
- [ ] Test batch reading

### Phase 5: Optimized PTK
- [ ] Create `OptimizedPTKManager`
- [ ] Implement file selection logic
- [ ] Test end-to-end

### Phase 6: Factory
- [ ] Create `PTKManagerFactory`
- [ ] Support both modes

### Phase 7: Integration
- [ ] Update `ChatViewProvider`
- [ ] Add configuration

### Phase 8: Testing
- [ ] Test standard mode
- [ ] Test optimized mode
- [ ] Compare performance

---

## Testing Strategy

### Unit Tests

**ContextBuilder:**
```typescript
test('should build workspace tree', async () => {
    const builder = new ContextBuilder(workspacePath, ignoreManager);
    const context = await builder.buildContext();
    
    expect(context.tree.type).toBe('directory');
    expect(context.stats.totalFiles).toBeGreaterThan(0);
});
```

**GroqLLMProvider:**
```typescript
test('should call Groq API', async () => {
    const groq = new GroqLLMProvider({ apiKey: 'test-key' });
    const response = await groq.call('Hello');
    
    expect(response).toBeDefined();
});
```

### Integration Tests

```typescript
test('Optimized PTK should use only 1 AI Studio call', async () => {
    let aiStudioCalls = 0;
    
    const mockAIStudio = {
        call: jest.fn().mockImplementation(() => {
            aiStudioCalls++;
            return Promise.resolve('Answer');
        })
    };
    
    const ptk = new OptimizedPTKManager(...);
    await ptk.orchestrateToolCalling('Read package.json');
    
    expect(aiStudioCalls).toBe(1);
});
```

### Performance Comparison

```typescript
async function comparePerformance() {
    const standardPTK = PTKManagerFactory.create({ mode: PTKMode.STANDARD, ... });
    const optimizedPTK = PTKManagerFactory.create({ mode: PTKMode.OPTIMIZED, ... });
    
    const prompt = 'Read package.json and tell me the version';
    
    // Standard
    const start1 = Date.now();
    const result1 = await standardPTK.orchestrateToolCalling(prompt);
    const duration1 = Date.now() - start1;
    
    // Optimized
    const start2 = Date.now();
    const result2 = await optimizedPTK.orchestrateToolCalling(prompt);
    const duration2 = Date.now() - start2;
    
    console.log('Standard:', duration1, 'ms');
    console.log('Optimized:', duration2, 'ms');
    console.log('Speedup:', (duration1 / duration2).toFixed(2), 'x');
}
```

---

## Configuration Guide

### Settings

1. **Mở Settings** (Ctrl+,)
2. Tìm "AI Agent"
3. Cấu hình:
   - **PTK Mode**: `optimized` hoặc `standard`
   - **Groq API Key**: Get từ https://console.groq.com

### Example `.vscode/settings.json`

```json
{
  "ai-agent.ptkMode": "optimized",
  "ai-agent.groqApiKey": "gsk_xxxxxxxxxxxxx"
}
```

---

## Expected Benefits

### Performance

| Metric | Standard | Optimized | Improvement |
|--------|----------|-----------|-------------|
| AI Studio Calls | 2-5 | 1 | 2-5x faster |
| Total Time | 10-30s | 3-8s | 3-4x faster |
| Cost | Medium | Low | 50-80% cheaper |

### User Experience

✅ Much faster responses
✅ Lower cost (Groq is cheap)
✅ Same quality answers
✅ Easy to switch modes

---

## Troubleshooting

### Groq API Key không hoạt động
- Check API key hợp lệ
- Verify network connection
- Fallback to standard mode

### Context building quá chậm
- Giảm `maxDepth`
- Enable caching
- Exclude large folders

### Groq chọn sai files
- Improve prompt engineering
- Add example prompts
- Use standard mode cho complex queries

---

## Future Enhancements

1. **Context Caching**: Cache workspace context để không phải rebuild mỗi lần
2. **Smart File Selection**: ML model để chọn files chính xác hơn
3. **Hybrid Mode**: Combine cả 2 modes tùy vào query complexity
4. **Streaming**: Stream Groq response để faster feedback
5. **Multi-LLM**: Support more LLM providers (Claude, OpenAI, etc.)

---

## Summary

**Optimized PTK Manager** giảm AI Studio calls từ 2-5 → **CHỈ 1** bằng cách:

1. ✅ Groq preprocessing (fast & cheap)
2. ✅ Local file reading (instant)
3. ✅ Single AI Studio call (với full context)

**Result**: 3-4x faster, 50-80% cheaper, same quality!
