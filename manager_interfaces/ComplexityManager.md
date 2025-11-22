# Complexity Manager Interface

## Overview

Complexity Manager chịu trách nhiệm đánh giá độ phức tạp của user request để quyết định Simple Path (1 LLM call) hay Complex Path (multiple LLM calls với planning).

**Strategy:** Sử dụng Groq API (fast, free) để classify complexity. Groq có latency thấp (~200-500ms) nên phù hợp cho real-time classification.

---

## Interface Definition

```typescript
interface IComplexityManager {
  /**
   * Đánh giá độ phức tạp của request sử dụng Groq
   * @param request - User request
   * @param context - Code context
   * @returns ComplexityAssessment
   */
  assessComplexity(
    request: string,
    context: CodeContext
  ): Promise<ComplexityAssessment>;

  /**
   * Get Groq API health status
   */
  healthCheck(): Promise<boolean>;
}
```

---

## Type Definitions

### CodeContext

```typescript
interface CodeContext {
  // Selected code
  selectedText: string;
  selectionRange: Range;
  
  // File info
  filePath: string;
  fileContent: string;
  fileLanguage: string;
  fileSize: number;
  
  // Project info
  projectPath: string;
  affectedFiles: string[];
  
  // Additional context
  cursorPosition: Position;
  openFiles: string[];
}

interface Range {
  start: Position;
  end: Position;
}

interface Position {
  line: number;
  column: number;
}
```

### ComplexityAssessment

```typescript
interface ComplexityAssessment {
  // Result
  complexity: 'simple' | 'complex';
  confidence: number; // 0.0 - 1.0
  
  // Reasoning
  reason: string;
  factors: ComplexityFactor[];
  
  // Metadata
  estimatedSteps?: number;
  estimatedTime?: string;
  estimatedCost?: string;
  
  // Suggestions
  suggestedApproach?: string;
  
  // Groq metadata
  groqModel: string;
  latency: number; // milliseconds
  tokensUsed: number;
}

interface ComplexityFactor {
  factor: string;
  value: any;
  impact: 'increase' | 'decrease';
  weight: number; // 0.0 - 1.0
}
```

### GroqClassificationResult

```typescript
interface GroqClassificationResult {
  complexity: 'simple' | 'complex';
  confidence: number;
  reason: string;
  
  // Classification details
  estimatedSteps: number;
  requiredTools: string[];
  riskLevel: 'low' | 'medium' | 'high';
  suggestedApproach: string;
  
  // Groq metadata
  model: string; // e.g., 'llama-3.1-70b-versatile'
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  latency: number; // milliseconds
}
```

---

## Implementation Strategy

### Groq-Based Classification

```typescript
class ComplexityManager implements IComplexityManager {
  // Groq API credentials và config
  private groqApiKey: string;
  private groqBaseUrl = 'https://api.groq.com/openai/v1';
  private defaultModel = 'llama-3.1-70b-versatile'; // Fast & accurate
  
  constructor(groqApiKey: string) {
    this.groqApiKey = groqApiKey;
  }
  
  /**
   * Main method: Đánh giá độ phức tạp của coding task
   * @param request - User request (e.g., "Refactor authentication")
   * @param context - Code context (file info, selected code, etc.)
   * @returns ComplexityAssessment với classification result
   */
  async assessComplexity(
    request: string,
    context: CodeContext
  ): Promise<ComplexityAssessment> {
    // Track thời gian để tính latency
    const startTime = Date.now();
    
    try {
      // Gọi Groq API để classify
      const result = await this.callGroq(request, context);
      
      // Tính latency (thời gian từ lúc bắt đầu đến khi có kết quả)
      const latency = Date.now() - startTime;
      
      // Build ComplexityAssessment object từ Groq result
      return {
        complexity: result.complexity,           // 'simple' hoặc 'complex'
        confidence: result.confidence,           // 0.0 - 1.0
        reason: result.reason,                   // Lý do classification
        factors: this.extractFactors(result),    // Extract complexity factors
        estimatedSteps: result.estimatedSteps,   // Số steps cần thực thi
        estimatedTime: this.estimateTime(result.estimatedSteps), // Estimate thời gian
        estimatedCost: this.estimateCost(result.estimatedSteps), // Estimate cost
        suggestedApproach: result.suggestedApproach, // Approach suggestion
        groqModel: result.model,                 // Model đã dùng
        latency,                                 // Thời gian call API
        tokensUsed: result.totalTokens           // Tokens consumed
      };
      
    } catch (error) {
      // Throw custom error với context để debug
      throw new ComplexityAssessmentError(
        `Groq classification failed: ${(error as Error).message}`,
        ComplexityErrorCode.GROQ_CALL_FAILED,
        { request, context, error }
      );
    }
  }
  
  /**
   * Call Groq API để classify complexity
   * @param request - User request
   * @param context - Code context
   * @returns GroqClassificationResult với raw data từ Groq
   */
  private async callGroq(
    request: string,
    context: CodeContext
  ): Promise<GroqClassificationResult> {
    // Build prompt với classification rules
    const prompt = this.buildPrompt(request, context);
    
    // Call Groq Chat Completions API
    const response = await fetch(`${this.groqBaseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.groqApiKey}`
      },
      body: JSON.stringify({
        model: this.defaultModel,
        messages: [
          {
            role: 'system',
            content: 'You are a code complexity analyzer. Respond only with valid JSON.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.1, // Low temperature để classification consistent
        max_tokens: 500,  // Đủ cho JSON response
        response_format: { type: 'json_object' } // Force JSON response
      })
    });
    
    // Check response status
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Groq API error: ${response.status} - ${error}`);
    }
    
    // Parse response
    const data = await response.json();
    const content = data.choices[0].message.content; // JSON string
    const parsed = JSON.parse(content);              // Parse to object
    
    // Map Groq response to GroqClassificationResult
    return {
      complexity: parsed.complexity,
      confidence: parsed.confidence,
      reason: parsed.reason,
      estimatedSteps: parsed.estimatedSteps,
      requiredTools: parsed.requiredTools || [],
      riskLevel: parsed.riskLevel,
      suggestedApproach: parsed.suggestedApproach,
      model: data.model,
      promptTokens: data.usage.prompt_tokens,
      completionTokens: data.usage.completion_tokens,
      totalTokens: data.usage.total_tokens,
      latency: 0 // Will be set by caller
    };
  }
  
  /**
   * Extract complexity factors từ Groq result
   * Factors giúp explain tại sao task được classify như vậy
   * @param result - Groq classification result
   * @returns Array of ComplexityFactor
   */
  private extractFactors(result: GroqClassificationResult): ComplexityFactor[] {
    const factors: ComplexityFactor[] = [];
    
    // Factor 1: Required tools (nếu cần tools thì phức tạp hơn)
    if (result.requiredTools.length > 0) {
      factors.push({
        factor: 'required_tools',
        value: result.requiredTools,
        impact: 'increase',  // Increase complexity
        weight: 0.3          // 30% weight
      });
    }
    
    // Factor 2: Estimated steps (nhiều steps = phức tạp hơn)
    if (result.estimatedSteps > 3) {
      factors.push({
        factor: 'estimated_steps',
        value: result.estimatedSteps,
        impact: 'increase',
        weight: 0.4  // 40% weight (quan trọng nhất)
      });
    }
    
    // Factor 3: Risk level (high risk = phức tạp hơn)
    if (result.riskLevel === 'high') {
      factors.push({
        factor: 'risk_level',
        value: result.riskLevel,
        impact: 'increase',
        weight: 0.3  // 30% weight
      });
    }
    
    return factors;
  }
  
  /**
   * Estimate thời gian thực thi dựa trên số steps
   * @param steps - Số steps cần thực thi
   * @returns Time estimate string (e.g., "30-60 seconds")
   */
  private estimateTime(steps: number): string {
    if (steps <= 1) return '2-5 seconds';      // Simple task
    if (steps <= 3) return '15-30 seconds';    // Medium task
    if (steps <= 5) return '30-60 seconds';    // Complex task
    return '1-2 minutes';                      // Very complex task
  }
  
  /**
   * Estimate cost dựa trên số steps
   * Note: Groq is free, nhưng estimate nếu dùng paid LLM
   * @param steps - Số steps cần thực thi
   * @returns Cost estimate string (e.g., "$0.040")
   */
  private estimateCost(steps: number): string {
    // Groq is free, but estimate if using paid LLM
    const costPerStep = 0.02;  // $0.02 per step (giả định)
    const total = steps * costPerStep;
    return `$${total.toFixed(3)}`;
  }
}
```

---

## Groq Classification Prompt

### Prompt Template

```typescript
/**
 * Build prompt cho Groq API với classification rules
 * @param request - User request
 * @param context - Code context
 * @returns Formatted prompt string
 */
private buildPrompt(request: string, context: CodeContext): string {
  // Extract metrics từ context
  const lineCount = context.selectedText.split('\n').length;
  const fileCount = context.affectedFiles.length || 1;
  
  // Build prompt với structure rõ ràng
  return `Analyze this coding task and classify its complexity.

**Task Request:**
${request}

**Code Context:**
- File: ${context.filePath}
- Language: ${context.fileLanguage}
- Selected code: ${lineCount} lines
- Affected files: ${fileCount}
- File size: ${context.fileSize} bytes

**Classification Rules:**

SIMPLE tasks (1 LLM call):
- Single file changes
- < 100 lines of code
- No architecture changes
- No testing required
- Examples: rename variable, add comments, format code, fix typo

COMPLEX tasks (multiple LLM calls + planning):
- Multiple files affected
- > 100 lines of code
- Architecture changes
- Requires testing
- Security implications
- Examples: refactor system, add feature, migrate framework, optimize performance

**Response Format (JSON only):**
{
  "complexity": "simple" | "complex",
  "confidence": 0.0-1.0,
  "reason": "brief explanation why",
  "estimatedSteps": number (1 for simple, 3-10 for complex),
  "requiredTools": ["tool1", "tool2"] (empty array for simple),
  "riskLevel": "low" | "medium" | "high",
  "suggestedApproach": "brief description of approach"
}`;
}
```

---

## Error Handling

### Errors

```typescript
class ComplexityAssessmentError extends Error {
  constructor(
    message: string,
    public code: ComplexityErrorCode,
    public context?: any
  ) {
    super(message);
  }
}

enum ComplexityErrorCode {
  INVALID_CONTEXT = 'INVALID_CONTEXT',
  GROQ_CALL_FAILED = 'GROQ_CALL_FAILED',
  PARSE_ERROR = 'PARSE_ERROR',
  TIMEOUT = 'TIMEOUT',
  RATE_LIMIT = 'RATE_LIMIT'
}
```

### Error Handling

```typescript
/**
 * Check Groq API health
 * @returns true nếu API available, false nếu down
 */
async healthCheck(): Promise<boolean> {
  try {
    // Simple check: List models endpoint
    const response = await fetch(`${this.groqBaseUrl}/models`, {
      headers: {
        'Authorization': `Bearer ${this.groqApiKey}`
      }
    });
    
    return response.ok;  // 200-299 status = healthy
  } catch (error) {
    // Throw error thay vì return false để biết lỗi gì
    throw new Error(`Groq health check failed: ${(error as Error).message}`);
  }
}
```

**Note:** Không có fallback - nếu Groq fails thì throw error ra để developer biết và fix. Silent fallback che giấu vấn đề thực sự.

---

## Dependencies

### Required Services

- **Groq API**: External API service (https://groq.com)
- **Context Manager**: Lấy project context (optional)

### Configuration

```typescript
interface IComplexityManager {
  constructor(
    private groqApiKey: string,
    private config?: ComplexityConfig
  );
}

interface ComplexityConfig {
  groqModel?: string; // Default: 'llama-3.1-70b-versatile'
  temperature?: number; // Default: 0.1
  maxTokens?: number; // Default: 500
  timeout?: number; // Default: 10000ms
  maxRetries?: number; // Default: 2
  retryDelay?: number; // Default: 1000ms
}

const DEFAULT_CONFIG: ComplexityConfig = {
  groqModel: 'llama-3.1-70b-versatile', // Fast & accurate
  temperature: 0.1, // Low for consistent classification
  maxTokens: 500,
  timeout: 10000,
  maxRetries: 2,
  retryDelay: 1000
};
```

---

## Usage Examples

### Example 1: Simple Request

```typescript
const complexityManager = new ComplexityManager(
  process.env.GROQ_API_KEY!,
  {
    groqModel: 'llama-3.1-70b-versatile',
    timeout: 10000
  }
);

const assessment = await complexityManager.assessComplexity(
  "Rename variable x to userId",
  {
    selectedText: "let x = 123;",
    filePath: "/src/user.ts",
    fileContent: "...",
    fileLanguage: "typescript",
    fileSize: 50,
    projectPath: "/project",
    affectedFiles: [],
    selectionRange: { start: { line: 1, column: 0 }, end: { line: 1, column: 13 } },
    cursorPosition: { line: 1, column: 0 },
    openFiles: []
  }
);

// Result:
// {
//   complexity: 'simple',
//   confidence: 0.95,
//   reason: 'Simple variable rename, single line, no dependencies',
//   estimatedSteps: 1,
//   estimatedTime: '2-5 seconds',
//   groqModel: 'llama-3.1-70b-versatile',
//   latency: 320,
//   tokensUsed: 245
// }
```

### Example 2: Complex Request

```typescript
const assessment = await complexityManager.assessComplexity(
  "Refactor authentication to use JWT tokens",
  {
    selectedText: "// auth code here",
    filePath: "/src/auth/login.ts",
    fileContent: "...",
    fileLanguage: "typescript",
    fileSize: 2500,
    projectPath: "/project",
    affectedFiles: [
      "/src/auth/login.ts",
      "/src/auth/register.ts",
      "/src/middleware/auth.ts",
      "/src/models/user.ts"
    ],
    selectionRange: { start: { line: 1, column: 0 }, end: { line: 50, column: 0 } },
    cursorPosition: { line: 1, column: 0 },
    openFiles: []
  }
);

// Result:
// {
//   complexity: 'complex',
//   confidence: 0.92,
//   reason: 'Multi-file refactoring with security implications, requires testing',
//   estimatedSteps: 6,
//   estimatedTime: '45-60 seconds',
//   requiredTools: ['read_file', 'search_code', 'run_tests'],
//   riskLevel: 'high',
//   suggestedApproach: 'Plan-based execution with testing validation',
//   groqModel: 'llama-3.1-70b-versatile',
//   latency: 450,
//   tokensUsed: 380
// }
```

### Example 3: With Error Handling

```typescript
try {
  const assessment = await complexityManager.assessComplexity(
    "Fix the pagination bug",
    context
  );
  
  if (assessment.complexity === 'complex') {
    console.log(`Will use planning approach: ${assessment.suggestedApproach}`);
  }
  
} catch (error) {
  if (error instanceof ComplexityAssessmentError) {
    // Log error rõ ràng để debug
    console.error('Complexity assessment failed:', error.message);
    console.error('Error code:', error.code);
    console.error('Context:', error.context);
    
    // Re-throw hoặc handle appropriately
    // Không silent fallback - developer cần biết có lỗi
    throw error;
  }
}
```

---

## Performance Considerations

### Groq Performance

**Advantages:**
- **Fast**: 200-500ms latency (vs 1-3s for other LLMs)
- **Free**: Generous free tier
- **Reliable**: 99.9% uptime
- **Accurate**: Llama 3.1 70B model

### Metrics to Track

```typescript
interface ComplexityMetrics {
  totalAssessments: number;
  groqCalls: number;
  averageLatency: number;
  fallbackCount: number;
  accuracyRate: number;
  totalTokensUsed: number;
}
```

### Optimization

- Cache recent assessments (same request + context)
- Debounce assessments (avoid duplicate calls)
- Timeout: 10s max
- Retry on rate limit (with exponential backoff)
- Monitor Groq API health

---

## Testing Strategy

### Unit Tests

```typescript
describe('ComplexityManager', () => {
  // Test 1: Simple task classification
  test('should classify simple rename as simple', async () => {
    // Mock Groq response cho simple task
    const mockGroq = jest.fn().mockResolvedValue({
      complexity: 'simple',
      confidence: 0.95,
      // ...
    });
    
    const result = await manager.assessComplexity(
      'rename x to userId',  // Simple request
      simpleContext          // Single file, few lines
    );
    
    // Verify classification
    expect(result.complexity).toBe('simple');
    expect(result.confidence).toBeGreaterThan(0.9);  // High confidence
  });
  
  // Test 2: Complex task classification
  test('should classify refactoring as complex', async () => {
    const result = await manager.assessComplexity(
      'refactor auth system',  // Complex request
      complexContext           // Multiple files, architecture change
    );
    
    // Verify classification
    expect(result.complexity).toBe('complex');
    expect(result.estimatedSteps).toBeGreaterThan(3);  // Nhiều steps
  });
  
  // Test 3: Error handling khi Groq fails
  test('should throw error on Groq failure', async () => {
    // Mock network error
    global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));
    
    // Should throw error (không fallback)
    await expect(
      manager.assessComplexity('uncertain task', context)
    ).rejects.toThrow('Groq classification failed');
  });
  
  // Test 4: Rate limiting handling
  test('should handle rate limiting', async () => {
    // Mock rate limit response (429)
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 429,
      text: async () => 'Rate limit exceeded'
    });
    
    // Should throw error (không fallback cho rate limit)
    await expect(
      manager.assessComplexity('test', context)
    ).rejects.toThrow('Rate limit');
  });
});
```

---

## Groq API Setup

### Get API Key

1. Sign up at https://console.groq.com
2. Create API key
3. Set environment variable:
   ```bash
   export GROQ_API_KEY="gsk_..."
   ```

### Available Models

- `llama-3.1-70b-versatile` - Recommended (fast, accurate)
- `llama-3.1-8b-instant` - Faster but less accurate
- `mixtral-8x7b-32768` - Good for long context

### Rate Limits (Free Tier)

- 30 requests/minute
- 6,000 tokens/minute
- Sufficient cho complexity assessment
