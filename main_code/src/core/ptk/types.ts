/**
 * PTK (Prompt-based Tool Kalling) Type Definitions
 */

/**
 * Parameter definition for a tool
 */
export interface PTKParameter {
    type: 'string' | 'number' | 'boolean' | 'object' | 'array';
    description: string;
    enum?: any[];
    items?: PTKParameter;
}

/**
 * Tool definition for PTK
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

/**
 * Tool call from LLM
 */
export interface PTKToolCall {
    tool: string;
    args: Record<string, any>;
    reasoning?: string;
}

/**
 * Message in conversation
 */
export interface PTKMessage {
    role: 'system' | 'user' | 'assistant' | 'tool';
    content: string;
}

/**
 * Response from LLM
 */
export interface PTKResponse {
    type: 'text' | 'tool_call';
    content?: string;
    toolCall?: PTKToolCall;
    raw: string;
}

/**
 * Tool execution result
 */
export interface PTKToolResult {
    success: boolean;
    data?: any;
    error?: string;
}

/**
 * Validation result for tool call
 */
export interface PTKValidation {
    valid: boolean;
    error?: string;
}

/**
 * Iteration information
 */
export interface IterationInfo {
    iteration: number;
    type: 'text' | 'tool_call';
    content?: string;
    toolCallsSoFar: number;
}

/**
 * Options for PTK execution
 */
export interface PTKExecuteOptions {
    // Available tools (tool names or tool objects)
    tools?: string[] | PTKTool[];

    // Execution limits
    maxIterations?: number;  // Default: 10
    maxToolCalls?: number;   // Default: 20
    timeout?: number;        // milliseconds

    // Callbacks
    onIteration?: (info: IterationInfo) => void;
    onToolCall?: (toolCall: PTKToolCall) => void;
    onError?: (error: Error) => void;
    onDuplicateDetected?: (toolCall: PTKToolCall) => void;

    // LLM configuration
    model?: string;
    temperature?: number;

    // Safety options
    detectDuplicates?: boolean;  // Default: true
    duplicateWindow?: number;    // Default: 3
}

/**
 * Result of PTK execution
 */
export interface PTKExecuteResult {
    // Status
    success: boolean;

    // Output
    content: string;

    // Execution info
    iterations: number;
    messages: PTKMessage[];
    toolCalls: PTKToolCall[];
    totalToolCalls: number;

    // Error (if failed)
    error?: string;

    // Metadata
    totalTokens?: number;
    totalCost?: number;
    duration: number;  // milliseconds
}

/**
 * LLM call options
 */
export interface LLMOptions {
    model?: string;
    temperature?: number;
    maxTokens?: number;
}
