# LLM Manager Interface

## Overview

LLM Manager chịu trách nhiệm gọi các LLM providers (AI Studio, OpenAI, Claude, etc.). Nhiệm vụ duy nhất là gọi LLM và trả về response - KHÔNG xử lý prompt building hay response parsing (PTK Manager làm việc đó).

---

## Interface Definition

```typescript
interface ILLMManager {
  /**
   * Call LLM với prompt
   * @param prompt - Đã được format sẵn
   * @param config - LLM configuration
   * @returns Raw response text
   */
  call(prompt: string, config?: LLMConfig): Promise<string>;

  /**
   * Get available models từ provider
   */
  getAvailableModels(): Promise<ModelInfo[]>;

  /**
   * Get current provider info
   */
  getProviderInfo(): ProviderInfo;

  /**
   * Switch provider
   */
  switchProvider(provider: LLMProvider): void;

  /**
   * Check provider health
   */
  healthCheck(): Promise<HealthStatus>;
}
```

---

## Type Definitions

### LLMConfig

```typescript
interface LLMConfig {
  // Model selection
  model?: string; // e.g., 'gemini-1.5-pro', 'gpt-4'
  provider?: LLMProvider; // Override default provider
  
  // Generation params
  temperature?: number; // 0.0 - 2.0
  maxTokens?: number;
  topP?: number;
  topK?: number;
  stopSequences?: string[];
  
  // System prompt
  systemPrompt?: string;
  
  // Timeout
  timeout?: number; // milliseconds
  
  // Retry
  maxRetries?: number;
  retryDelay?: number;
}

enum LLMProvider {
  AI_STUDIO = 'ai_studio', // Google AI Studio (browser automation)
  OPENAI = 'openai',
  ANTHROPIC = 'anthropic',
  OLLAMA = 'ollama', // Local models
  CUSTOM = 'custom'
}
```

### ModelInfo

```typescript
interface ModelInfo {
  id: string; // e.g., 'gemini-1.5-pro'
  name: string;
  provider: LLMProvider;
  
  // Capabilities
  maxTokens: number;
  supportsStreaming: boolean;
  supportsFunctionCalling: boolean;
  
  // Pricing (per 1K tokens)
  inputCost?: number;
  outputCost?: number;
  
  // Metadata
  description?: string;
  releaseDate?: string;
}
```

### ProviderInfo

```typescript
interface ProviderInfo {
  provider: LLMProvider;
  status: 'connected' | 'disconnected' | 'error';
  currentModel: string;
  
  // Auth info
  authenticated: boolean;
  authMethod: 'api_key' | 'browser' | 'oauth' | 'none';
  
  // Usage stats
  totalCalls: number;
  totalTokens: number;
  estimatedCost: number;
  
  // Rate limits
  rateLimitRemaining?: number;
  rateLimitReset?: Date;
}
```

### HealthStatus

```typescript
interface HealthStatus {
  healthy: boolean;
  provider: LLMProvider;
  latency: number; // milliseconds
  lastChecked: Date;
  
  issues?: HealthIssue[];
}

interface HealthIssue {
  severity: 'warning' | 'error';
  message: string;
  code: string;
}
```

---

## Provider Implementations

### AI Studio Provider (Browser Automation)

```typescript
class AIStudioProvider implements ILLMProvider {
  private browserManager: BrowserBridgeManager;
  private sessionActive: boolean = false;
  
  constructor(browserManager: BrowserBridgeManager) {
    this.browserManager = browserManager;
  }
  
  async call(prompt: string, config?: LLMConfig): Promise<string> {
    // Ensure session active
    if (!this.sessionActive) {
      await this.initializeSession();
    }
    
    // Send prompt via browser automation
    const response = await this.browserManager.sendPrompt(prompt, {
      model: config?.model || 'gemini-1.5-pro',
      temperature: config?.temperature,
      maxTokens: config?.maxTokens,
      timeout: config?.timeout || 30000
    });
    
    // Extract response text
    return response.text;
  }
  
  private async initializeSession(): Promise<void> {
    // Navigate to AI Studio
    await this.browserManager.navigate('https://aistudio.google.com');
    
    // Check if logged in
    const loggedIn = await this.browserManager.checkAuthentication();
    
    if (!loggedIn) {
      throw new Error('Not authenticated with AI Studio');
    }
    
    this.sessionActive = true;
  }
  
  async getAvailableModels(): Promise<ModelInfo[]> {
    return [
      {
        id: 'gemini-1.5-pro',
        name: 'Gemini 1.5 Pro',
        provider: LLMProvider.AI_STUDIO,
        maxTokens: 1000000,
        supportsStreaming: true,
        supportsFunctionCalling: false // Via browser, no
        inputCost: 0,
        outputCost: 0
      },
      {
        id: 'gemini-1.5-flash',
        name: 'Gemini 1.5 Flash',
        provider: LLMProvider.AI_STUDIO,
        maxTokens: 1000000,
        supportsStreaming: true,
        supportsFunctionCalling: false,
        inputCost: 0,
        outputCost: 0
      }
    ];
  }
  
  async healthCheck(): Promise<HealthStatus> {
    const startTime = Date.now();
    
    try {
      // Simple ping check
      const response = await this.call('ping', {
        timeout: 5000
      });
      
      return {
        healthy: true,
        provider: LLMProvider.AI_STUDIO,
        latency: Date.now() - startTime,
        lastChecked: new Date()
      };
    } catch (error) {
      return {
        healthy: false,
        provider: LLMProvider.AI_STUDIO,
        latency: Date.now() - startTime,
        lastChecked: new Date(),
        issues: [{
          severity: 'error',
          message: (error as Error).message,
          code: 'CONNECTION_FAILED'
        }]
      };
    }
  }
}
```

### OpenAI Provider (API)

```typescript
class OpenAIProvider implements ILLMProvider {
  private apiKey: string;
  private baseUrl: string = 'https://api.openai.com/v1';
  
  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }
  
  async call(prompt: string, config?: LLMConfig): Promise<string> {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: config?.model || 'gpt-4',
        messages: [
          {
            role: 'system',
            content: config?.systemPrompt || 'You are a helpful assistant.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: config?.temperature || 0.7,
        max_tokens: config?.maxTokens,
        top_p: config?.topP,
        stop: config?.stopSequences
      })
    });
    
    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    return data.choices[0].message.content;
  }
  
  async getAvailableModels(): Promise<ModelInfo[]> {
    const response = await fetch(`${this.baseUrl}/models`, {
      headers: {
        'Authorization': `Bearer ${this.apiKey}`
      }
    });
    
    const data = await response.json();
    
    return data.data
      .filter((m: any) => m.id.startsWith('gpt'))
      .map((m: any) => ({
        id: m.id,
        name: m.id,
        provider: LLMProvider.OPENAI,
        maxTokens: this.getMaxTokens(m.id),
        supportsStreaming: true,
        supportsFunctionCalling: true,
        inputCost: this.getInputCost(m.id),
        outputCost: this.getOutputCost(m.id)
      }));
  }
  
  private getMaxTokens(modelId: string): number {
    const tokenLimits: Record<string, number> = {
      'gpt-4': 8192,
      'gpt-4-32k': 32768,
      'gpt-4-turbo': 128000,
      'gpt-3.5-turbo': 4096
    };
    
    return tokenLimits[modelId] || 4096;
  }
  
  private getInputCost(modelId: string): number {
    // Per 1K tokens
    const costs: Record<string, number> = {
      'gpt-4': 0.03,
      'gpt-4-turbo': 0.01,
      'gpt-3.5-turbo': 0.0015
    };
    
    return costs[modelId] || 0;
  }
  
  private getOutputCost(modelId: string): number {
    const costs: Record<string, number> = {
      'gpt-4': 0.06,
      'gpt-4-turbo': 0.03,
      'gpt-3.5-turbo': 0.002
    };
    
    return costs[modelId] || 0;
  }
  
  async healthCheck(): Promise<HealthStatus> {
    const startTime = Date.now();
    
    try {
      await this.getAvailableModels();
      
      return {
        healthy: true,
        provider: LLMProvider.OPENAI,
        latency: Date.now() - startTime,
        lastChecked: new Date()
      };
    } catch (error) {
      return {
        healthy: false,
        provider: LLMProvider.OPENAI,
        latency: Date.now() - startTime,
        lastChecked: new Date(),
        issues: [{
          severity: 'error',
          message: (error as Error).message,
          code: 'API_ERROR'
        }]
      };
    }
  }
}
```

### Ollama Provider (Local)

```typescript
class OllamaProvider implements ILLMProvider {
  private baseUrl: string = 'http://localhost:11434';
  
  async call(prompt: string, config?: LLMConfig): Promise<string> {
    const response = await fetch(`${this.baseUrl}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: config?.model || 'llama2',
        prompt: prompt,
        stream: false,
        options: {
          temperature: config?.temperature,
          num_predict: config?.maxTokens,
          top_p: config?.topP,
          top_k: config?.topK,
          stop: config?.stopSequences
        }
      })
    });
    
    if (!response.ok) {
      throw new Error(`Ollama error: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    return data.response;
  }
  
  async getAvailableModels(): Promise<ModelInfo[]> {
    const response = await fetch(`${this.baseUrl}/api/tags`);
    const data = await response.json();
    
    return data.models.map((m: any) => ({
      id: m.name,
      name: m.name,
      provider: LLMProvider.OLLAMA,
      maxTokens: 4096,
      supportsStreaming: true,
      supportsFunctionCalling: false,
      inputCost: 0,
      outputCost: 0,
      description: `Local model: ${m.name}`
    }));
  }
  
  async healthCheck(): Promise<HealthStatus> {
    const startTime = Date.now();
    
    try {
      await fetch(this.baseUrl);
      
      return {
        healthy: true,
        provider: LLMProvider.OLLAMA,
        latency: Date.now() - startTime,
        lastChecked: new Date()
      };
    } catch (error) {
      return {
        healthy: false,
        provider: LLMProvider.OLLAMA,
        latency: Date.now() - startTime,
        lastChecked: new Date(),
        issues: [{
          severity: 'error',
          message: 'Ollama server not running',
          code: 'SERVER_OFFLINE'
        }]
      };
    }
  }
}
```

---

## LLM Manager Implementation

```typescript
class LLMManager implements ILLMManager {
  private providers: Map<LLMProvider, ILLMProvider> = new Map();
  private currentProvider: LLMProvider;
  private defaultConfig: LLMConfig;
  
  constructor(config: LLMManagerConfig) {
    this.defaultConfig = config.defaultConfig;
    this.currentProvider = config.defaultProvider;
    
    // Initialize providers
    this.initializeProviders(config);
  }
  
  private initializeProviders(config: LLMManagerConfig): void {
    // AI Studio
    if (config.aiStudio) {
      this.providers.set(
        LLMProvider.AI_STUDIO,
        new AIStudioProvider(config.aiStudio.browserManager)
      );
    }
    
    // OpenAI
    if (config.openai?.apiKey) {
      this.providers.set(
        LLMProvider.OPENAI,
        new OpenAIProvider(config.openai.apiKey)
      );
    }
    
    // Ollama
    if (config.ollama?.enabled) {
      this.providers.set(
        LLMProvider.OLLAMA,
        new OllamaProvider()
      );
    }
  }
  
  async call(prompt: string, config?: LLMConfig): Promise<string> {
    const provider = this.getProvider(config?.provider || this.currentProvider);
    
    const mergedConfig = {
      ...this.defaultConfig,
      ...config
    };
    
    try {
      const response = await provider.call(prompt, mergedConfig);
      
      // Track usage
      this.trackUsage(provider, prompt, response);
      
      return response;
      
    } catch (error) {
      // Handle provider-specific errors
      throw new LLMCallError(
        `LLM call failed: ${(error as Error).message}`,
        LLMErrorCode.CALL_FAILED,
        { provider: config?.provider || this.currentProvider, error }
      );
    }
  }
  
  async getAvailableModels(): Promise<ModelInfo[]> {
    const allModels: ModelInfo[] = [];
    
    for (const [providerType, provider] of this.providers) {
      try {
        const models = await provider.getAvailableModels();
        allModels.push(...models);
      } catch (error) {
        console.warn(`Failed to get models from ${providerType}:`, error);
      }
    }
    
    return allModels;
  }
  
  getProviderInfo(): ProviderInfo {
    const provider = this.getProvider(this.currentProvider);
    
    // Return cached info
    return this.providerInfoCache.get(this.currentProvider) || {
      provider: this.currentProvider,
      status: 'disconnected',
      currentModel: this.defaultConfig.model || 'unknown',
      authenticated: false,
      authMethod: 'none',
      totalCalls: 0,
      totalTokens: 0,
      estimatedCost: 0
    };
  }
  
  switchProvider(provider: LLMProvider): void {
    if (!this.providers.has(provider)) {
      throw new Error(`Provider ${provider} not initialized`);
    }
    
    this.currentProvider = provider;
  }
  
  async healthCheck(): Promise<HealthStatus> {
    const provider = this.getProvider(this.currentProvider);
    return provider.healthCheck();
  }
  
  private getProvider(providerType: LLMProvider): ILLMProvider {
    const provider = this.providers.get(providerType);
    
    if (!provider) {
      throw new Error(`Provider ${providerType} not available`);
    }
    
    return provider;
  }
  
  private trackUsage(
    provider: ILLMProvider,
    prompt: string,
    response: string
  ): void {
    // Track tokens, cost, etc.
    // Implementation depends on provider
  }
}
```

---

## Error Handling

```typescript
class LLMCallError extends Error {
  constructor(
    message: string,
    public code: LLMErrorCode,
    public context?: any
  ) {
    super(message);
  }
}

enum LLMErrorCode {
  CALL_FAILED = 'CALL_FAILED',
  RATE_LIMIT = 'RATE_LIMIT',
  TIMEOUT = 'TIMEOUT',
  INVALID_CONFIG = 'INVALID_CONFIG',
  PROVIDER_NOT_AVAILABLE = 'PROVIDER_NOT_AVAILABLE',
  AUTHENTICATION_FAILED = 'AUTHENTICATION_FAILED'
}
```

---

## Configuration

```typescript
interface LLMManagerConfig {
  defaultProvider: LLMProvider;
  defaultConfig: LLMConfig;
  
  // Provider configs
  aiStudio?: {
    browserManager: BrowserBridgeManager;
  };
  
  openai?: {
    apiKey: string;
    organization?: string;
  };
  
  anthropic?: {
    apiKey: string;
  };
  
  ollama?: {
    enabled: boolean;
    baseUrl?: string;
  };
}
```

---

## Usage Examples

### Example 1: Simple LLM Call

```typescript
const llmManager = new LLMManager({
  defaultProvider: LLMProvider.AI_STUDIO,
  defaultConfig: {
    model: 'gemini-1.5-pro',
    temperature: 0.7,
    maxTokens: 2000
  },
  aiStudio: { browserManager }
});

const response = await llmManager.call(
  "Explain this code: function add(a, b) { return a + b; }"
);

console.log(response);
// "This is a simple JavaScript function that adds two numbers..."
```

### Example 2: Override Config

```typescript
const response = await llmManager.call(
  "Generate a refactored version of this code",
  {
    temperature: 0.2, // Low creativity for code generation
    maxTokens: 4000,
    systemPrompt: "You are an expert code refactorer."
  }
);
```

### Example 3: Switch Provider

```typescript
// Use AI Studio
llmManager.switchProvider(LLMProvider.AI_STUDIO);
const response1 = await llmManager.call("What is React?");

// Switch to OpenAI
llmManager.switchProvider(LLMProvider.OPENAI);
const response2 = await llmManager.call("What is React?", {
  model: 'gpt-4'
});

// Compare responses
```

---

## Dependencies

```typescript
interface ILLMManager {
  constructor(config: LLMManagerConfig);
}
```

LLM Manager không depend vào managers khác - nó là leaf service.
