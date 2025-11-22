# Context Manager Interface

## Overview

Context Manager chịu trách nhiệm quản lý shared context, state giữa các steps, và provide context cho các managers khác trong quá trình execution.

---

## Interface Definition

```typescript
interface IContextManager {
  /**
   * Get value từ context
   */
  get<T = any>(key: string): T | undefined;

  /**
   * Set value vào context
   */
  set<T = any>(key: string, value: T): void;

  /**
   * Update context với partial updates
   */
  update(updates: Partial<Context>): void;

  /**
   * Merge context object
   */
  merge(newContext: Partial<Context>): void;

  /**
   * Delete key khỏi context
   */
  delete(key: string): void;

  /**
   * Clear toàn bộ context
   */
  clear(): void;

  /**
   * Get toàn bộ context
   */
  getAll(): Context;

  /**
   * Check if key exists
   */
  has(key: string): boolean;

  /**
   * Get nested value
   */
  getNested(path: string): any;

  /**
   * Set nested value
   */
  setNested(path: string, value: any): void;

  /**
   * Subscribe to context changes
   */
  subscribe(key: string, callback: ContextChangeCallback): () => void;

  /**
   * Create snapshot of current context
   */
  snapshot(): ContextSnapshot;

  /**
   * Restore context from snapshot
   */
  restore(snapshot: ContextSnapshot): void;
}
```

---

## Type Definitions

### Context

```typescript
interface Context {
  // Original request
  userRequest: string;
  selectedText: string;
  selectionRange?: Range;
  
  // File info
  filePath: string;
  fileContent: string;
  fileLanguage: string;
  
  // Project info
  projectPath: string;
  projectContext: ProjectContext;
  
  // Execution state
  currentPlan?: Plan;
  currentStepId?: string;
  completedSteps: StepResult[];
  
  // Accumulated data
  stepOutputs: Map<string, any>; // stepId -> output
  discoveries: Discovery[];
  errors: Error[];
  warnings: Warning[];
  
  // Shared state
  sharedState: Map<string, any>;
  
  // Metadata
  sessionId: string;
  startTime: Date;
  lastUpdated: Date;
  
  // Custom data
  custom: Record<string, any>;
}
```

### ProjectContext

```typescript
interface ProjectContext {
  projectPath: string;
  projectName: string;
  
  // Language/Framework
  language: string;
  framework?: string;
  
  // Dependencies
  dependencies: Dependency[];
  devDependencies: Dependency[];
  
  // Build system
  buildTool?: string; // npm, yarn, pnpm, etc.
  testFramework?: string; // jest, vitest, mocha, etc.
  
  // Files
  totalFiles: number;
  sourceFiles: string[];
  testFiles: string[];
  configFiles: string[];
  
  // Git
  gitEnabled: boolean;
  currentBranch?: string;
  
  // VS Code workspace
  workspaceRoot: string;
  openFiles: string[];
}

interface Dependency {
  name: string;
  version: string;
  type: 'production' | 'development';
}
```

### Discovery

```typescript
interface Discovery {
  id: string;
  timestamp: Date;
  stepId: string;
  type: 'file' | 'dependency' | 'pattern' | 'issue' | 'other';
  title: string;
  description: string;
  data: any;
  importance: 'low' | 'medium' | 'high';
}
```

### Warning

```typescript
interface Warning {
  id: string;
  timestamp: Date;
  stepId?: string;
  message: string;
  code: string;
  severity: 'info' | 'warning';
}
```

### ContextSnapshot

```typescript
interface ContextSnapshot {
  timestamp: Date;
  context: Context;
  checksum: string;
}
```

### ContextChangeCallback

```typescript
type ContextChangeCallback = (change: ContextChange) => void;

interface ContextChange {
  key: string;
  oldValue: any;
  newValue: any;
  timestamp: Date;
}
```

---

## Context Lifecycle

### Initialization

```typescript
class ContextManager implements IContextManager {
  private context: Context;
  private subscribers: Map<string, ContextChangeCallback[]> = new Map();
  private snapshots: ContextSnapshot[] = [];
  
  constructor(initialContext?: Partial<Context>) {
    this.context = this.initializeContext(initialContext);
  }
  
  private initializeContext(initial?: Partial<Context>): Context {
    return {
      // Defaults
      userRequest: '',
      selectedText: '',
      filePath: '',
      fileContent: '',
      fileLanguage: '',
      projectPath: '',
      projectContext: this.getDefaultProjectContext(),
      completedSteps: [],
      stepOutputs: new Map(),
      discoveries: [],
      errors: [],
      warnings: [],
      sharedState: new Map(),
      sessionId: this.generateSessionId(),
      startTime: new Date(),
      lastUpdated: new Date(),
      custom: {},
      
      // Override with initial values
      ...initial
    };
  }
  
  private getDefaultProjectContext(): ProjectContext {
    return {
      projectPath: '',
      projectName: '',
      language: '',
      dependencies: [],
      devDependencies: [],
      totalFiles: 0,
      sourceFiles: [],
      testFiles: [],
      configFiles: [],
      gitEnabled: false,
      workspaceRoot: '',
      openFiles: []
    };
  }
  
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
```

---

## Core Operations

### Get/Set

```typescript
get<T = any>(key: string): T | undefined {
  return this.context[key as keyof Context] as T;
}

set<T = any>(key: string, value: T): void {
  const oldValue = this.context[key as keyof Context];
  
  (this.context as any)[key] = value;
  this.context.lastUpdated = new Date();
  
  // Notify subscribers
  this.notifySubscribers(key, oldValue, value);
}

has(key: string): boolean {
  return key in this.context && this.context[key as keyof Context] !== undefined;
}

delete(key: string): void {
  const oldValue = this.context[key as keyof Context];
  
  delete (this.context as any)[key];
  this.context.lastUpdated = new Date();
  
  this.notifySubscribers(key, oldValue, undefined);
}
```

### Update/Merge

```typescript
update(updates: Partial<Context>): void {
  for (const [key, value] of Object.entries(updates)) {
    this.set(key, value);
  }
}

merge(newContext: Partial<Context>): void {
  // Deep merge
  this.context = this.deepMerge(this.context, newContext);
  this.context.lastUpdated = new Date();
}

private deepMerge(target: any, source: any): any {
  const output = { ...target };
  
  for (const key in source) {
    if (source[key] instanceof Object && key in target) {
      output[key] = this.deepMerge(target[key], source[key]);
    } else {
      output[key] = source[key];
    }
  }
  
  return output;
}
```

### Nested Access

```typescript
getNested(path: string): any {
  const keys = path.split('.');
  let current: any = this.context;
  
  for (const key of keys) {
    if (current === undefined || current === null) {
      return undefined;
    }
    current = current[key];
  }
  
  return current;
}

setNested(path: string, value: any): void {
  const keys = path.split('.');
  let current: any = this.context;
  
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (!(key in current) || typeof current[key] !== 'object') {
      current[key] = {};
    }
    current = current[key];
  }
  
  const lastKey = keys[keys.length - 1];
  const oldValue = current[lastKey];
  
  current[lastKey] = value;
  this.context.lastUpdated = new Date();
  
  this.notifySubscribers(path, oldValue, value);
}
```

---

## Subscription System

```typescript
subscribe(key: string, callback: ContextChangeCallback): () => void {
  if (!this.subscribers.has(key)) {
    this.subscribers.set(key, []);
  }
  
  this.subscribers.get(key)!.push(callback);
  
  // Return unsubscribe function
  return () => {
    const callbacks = this.subscribers.get(key);
    if (callbacks) {
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  };
}

private notifySubscribers(key: string, oldValue: any, newValue: any): void {
  const callbacks = this.subscribers.get(key) || [];
  
  const change: ContextChange = {
    key,
    oldValue,
    newValue,
    timestamp: new Date()
  };
  
  for (const callback of callbacks) {
    try {
      callback(change);
    } catch (error) {
      console.error(`Error in context subscriber for key '${key}':`, error);
    }
  }
}
```

---

## Snapshot & Restore

```typescript
snapshot(): ContextSnapshot {
  const snapshot: ContextSnapshot = {
    timestamp: new Date(),
    context: JSON.parse(JSON.stringify(this.context)),
    checksum: this.calculateChecksum(this.context)
  };
  
  this.snapshots.push(snapshot);
  
  return snapshot;
}

restore(snapshot: ContextSnapshot): void {
  // Verify checksum
  const checksum = this.calculateChecksum(snapshot.context);
  
  if (checksum !== snapshot.checksum) {
    throw new Error('Snapshot checksum mismatch - data may be corrupted');
  }
  
  this.context = JSON.parse(JSON.stringify(snapshot.context));
  this.context.lastUpdated = new Date();
}

private calculateChecksum(data: any): string {
  const crypto = require('crypto');
  const json = JSON.stringify(data);
  return crypto.createHash('md5').update(json).digest('hex');
}
```

---

## Helper Methods

### Add Discovery

```typescript
addDiscovery(discovery: Omit<Discovery, 'id' | 'timestamp'>): void {
  const newDiscovery: Discovery = {
    id: `discovery_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date(),
    ...discovery
  };
  
  this.context.discoveries.push(newDiscovery);
  this.context.lastUpdated = new Date();
}
```

### Add Error

```typescript
addError(error: Error, stepId?: string): void {
  this.context.errors.push(error);
  this.context.lastUpdated = new Date();
  
  // Also log to console
  console.error(`Context error (step: ${stepId || 'unknown'}):`, error);
}
```

### Add Warning

```typescript
addWarning(warning: Omit<Warning, 'id' | 'timestamp'>): void {
  const newWarning: Warning = {
    id: `warning_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date(),
    ...warning
  };
  
  this.context.warnings.push(newWarning);
  this.context.lastUpdated = new Date();
}
```

### Get Step Output

```typescript
getStepOutput<T = any>(stepId: string): T | undefined {
  return this.context.stepOutputs.get(stepId) as T;
}

setStepOutput(stepId: string, output: any): void {
  this.context.stepOutputs.set(stepId, output);
  this.context.lastUpdated = new Date();
}
```

---

## Project Context Builder

```typescript
async buildProjectContext(projectPath: string): Promise<ProjectContext> {
  const fs = require('fs').promises;
  const path = require('path');
  
  // Read package.json
  let packageJson: any = {};
  try {
    const packagePath = path.join(projectPath, 'package.json');
    const content = await fs.readFile(packagePath, 'utf-8');
    packageJson = JSON.parse(content);
  } catch (error) {
    console.warn('No package.json found');
  }
  
  // Detect language
  const language = await this.detectLanguage(projectPath);
  
  // Detect framework
  const framework = this.detectFramework(packageJson.dependencies || {});
  
  // Get dependencies
  const dependencies = Object.entries(packageJson.dependencies || {})
    .map(([name, version]) => ({
      name,
      version: version as string,
      type: 'production' as const
    }));
  
  const devDependencies = Object.entries(packageJson.devDependencies || {})
    .map(([name, version]) => ({
      name,
      version: version as string,
      type: 'development' as const
    }));
  
  // Find files
  const sourceFiles = await this.findSourceFiles(projectPath);
  const testFiles = await this.findTestFiles(projectPath);
  const configFiles = await this.findConfigFiles(projectPath);
  
  // Check git
  const gitEnabled = await this.checkGit(projectPath);
  let currentBranch: string | undefined;
  if (gitEnabled) {
    currentBranch = await this.getCurrentBranch(projectPath);
  }
  
  return {
    projectPath,
    projectName: packageJson.name || path.basename(projectPath),
    language,
    framework,
    dependencies,
    devDependencies,
    buildTool: this.detectBuildTool(projectPath),
    testFramework: this.detectTestFramework(devDependencies),
    totalFiles: sourceFiles.length + testFiles.length,
    sourceFiles,
    testFiles,
    configFiles,
    gitEnabled,
    currentBranch,
    workspaceRoot: projectPath,
    openFiles: []
  };
}

private async detectLanguage(projectPath: string): Promise<string> {
  const fs = require('fs').promises;
  const path = require('path');
  
  // Check for TypeScript
  const tsConfigPath = path.join(projectPath, 'tsconfig.json');
  try {
    await fs.access(tsConfigPath);
    return 'typescript';
  } catch {}
  
  // Check for JavaScript
  const packagePath = path.join(projectPath, 'package.json');
  try {
    await fs.access(packagePath);
    return 'javascript';
  } catch {}
  
  return 'unknown';
}

private detectFramework(dependencies: Record<string, string>): string | undefined {
  if ('react' in dependencies) return 'react';
  if ('vue' in dependencies) return 'vue';
  if ('@angular/core' in dependencies) return 'angular';
  if ('next' in dependencies) return 'next';
  if ('nuxt' in dependencies) return 'nuxt';
  if ('svelte' in dependencies) return 'svelte';
  
  return undefined;
}
```

---

## Usage Examples

### Example 1: Basic Get/Set

```typescript
const contextManager = new ContextManager({
  userRequest: 'Refactor authentication',
  filePath: '/src/auth/login.ts'
});

// Get value
const request = contextManager.get<string>('userRequest');
console.log(request); // "Refactor authentication"

// Set value
contextManager.set('currentStepId', 'step-1');

// Check if exists
if (contextManager.has('filePath')) {
  console.log('File path is set');
}
```

### Example 2: Nested Access

```typescript
// Set nested value
contextManager.setNested('projectContext.language', 'typescript');
contextManager.setNested('projectContext.framework', 'react');

// Get nested value
const lang = contextManager.getNested('projectContext.language');
console.log(lang); // "typescript"
```

### Example 3: Subscriptions

```typescript
// Subscribe to changes
const unsubscribe = contextManager.subscribe('currentStepId', (change) => {
  console.log(`Step changed from ${change.oldValue} to ${change.newValue}`);
});

// Update will trigger callback
contextManager.set('currentStepId', 'step-2');
// Output: "Step changed from step-1 to step-2"

// Unsubscribe
unsubscribe();
```

### Example 4: Snapshots

```typescript
// Create snapshot before risky operation
const snapshot = contextManager.snapshot();

// Do something risky
try {
  contextManager.set('errors', [new Error('Something went wrong')]);
  // ... more operations
} catch (error) {
  // Restore on error
  contextManager.restore(snapshot);
  console.log('Context restored to previous state');
}
```

### Example 5: Discoveries & Errors

```typescript
// Add discovery
contextManager.addDiscovery({
  stepId: 'step-2',
  type: 'file',
  title: 'Found additional auth file',
  description: 'Found auth.middleware.ts that also needs refactoring',
  data: { filePath: '/src/middleware/auth.middleware.ts' },
  importance: 'high'
});

// Add error
contextManager.addError(
  new Error('Failed to read file'),
  'step-3'
);

// Add warning
contextManager.addWarning({
  stepId: 'step-4',
  message: 'Test coverage below 80%',
  code: 'LOW_COVERAGE',
  severity: 'warning'
});
```

### Example 6: Step Outputs

```typescript
// Store step output
contextManager.setStepOutput('step-1', {
  analysis: 'Authentication uses outdated methods',
  files: ['/src/auth/login.ts', '/src/auth/register.ts']
});

// Retrieve step output later
const step1Output = contextManager.getStepOutput('step-1');
console.log(step1Output.files);
```

---

## Dependencies

Context Manager không depend vào managers khác - nó là shared service được dùng bởi tất cả managers khác.

---

## Configuration

```typescript
interface ContextManagerConfig {
  maxSnapshots?: number; // Default: 10
  enableAutoSnapshot?: boolean; // Auto snapshot before major operations
  snapshotInterval?: number; // Auto snapshot every N seconds
}
```
