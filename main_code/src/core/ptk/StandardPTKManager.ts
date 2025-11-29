/**
 * Standard PTK Manager - Multi-iteration tool calling
 */

import { IPTKManager } from './IPTKManager';
import { PTKFormatter } from './PTKFormatter';
import { PTKParser } from './PTKParser';
import { LLMManager } from '../llm/LLMManager';
import { ToolRegistry } from '../tools/ToolRegistry';
import { ContextManager } from '../context/ContextManager';
import { LogEmitter } from '../logging';
import {
    PTKTool,
    PTKMessage,
    PTKToolCall,
    PTKExecuteOptions,
    PTKExecuteResult
} from './types';
import { PTKExecutionError, PTKErrorCode } from './errors';

export class StandardPTKManager implements IPTKManager {
    private formatter: PTKFormatter;
    private parser: PTKParser;
    private logEmitter?: LogEmitter;

    constructor(
        private llmManager: LLMManager,
        private toolRegistry: ToolRegistry,
        private contextManager: ContextManager,
        logEmitter?: LogEmitter
    ) {
        this.formatter = new PTKFormatter();
        this.parser = new PTKParser();
        this.logEmitter = logEmitter;
    }

    /**
     * Main orchestration method
     * Orchestrate tool calling loop between LLM and Tools
     */
    async orchestrateToolCalling(
        prompt: string,
        options: PTKExecuteOptions = {}
    ): Promise<PTKExecuteResult> {
        const {
            tools = [],
            maxIterations = 10,
            maxToolCalls = 20,
            detectDuplicates = true,
            duplicateWindow = 3,
            onIteration,
            onToolCall,
            onError,
            onDuplicateDetected
        } = options;

        // Get available tools
        let availableTools: PTKTool[];
        if (Array.isArray(tools) && tools.length > 0) {
            if (typeof tools[0] === 'string') {
                // Tool names provided
                availableTools = (tools as string[])
                    .map(name => this.toolRegistry.get(name))
                    .filter((t): t is PTKTool => t !== undefined);
            } else {
                // Tool objects provided
                availableTools = tools as PTKTool[];
            }
        } else {
            // Use all registered tools
            availableTools = this.toolRegistry.getAll();
        }

        const toolMap = new Map(availableTools.map(t => [t.name, t]));
        const messages: PTKMessage[] = [];
        const toolCalls: PTKToolCall[] = [];

        // Build system prompt with tool definitions
        const systemPrompt = this.formatter.formatSystemPrompt(availableTools);
        messages.push({ role: 'system', content: systemPrompt });
        messages.push({ role: 'user', content: prompt });

        let iteration = 0;
        let toolCallCount = 0;
        const startTime = Date.now();

        this.logEmitter?.emit('info', 'ptk', `Bắt đầu orchestration (max ${maxIterations} iterations, ${availableTools.length} tools)`);

        while (iteration < maxIterations) {
            iteration++;
            this.logEmitter?.emit('info', 'ptk', `Iteration ${iteration}/${maxIterations}`);

            try {
                // Format conversation for LLM
                const fullPrompt = this.formatter.formatConversation(messages);

                // Call LLM (delegate to LLMManager)
                this.logEmitter?.emit('info', 'ptk', 'Gửi prompt tới LLM...');
                const llmResponse = await this.llmManager.call(fullPrompt, {
                    model: options.model,
                    temperature: options.temperature
                });

                // Parse response
                this.logEmitter?.emit('info', 'ptk', 'Parsing response từ LLM...');
                const parsed = this.parser.parse(llmResponse);

                onIteration?.({
                    iteration,
                    type: parsed.type,
                    content: parsed.type === 'text' ? parsed.content : undefined,
                    toolCallsSoFar: toolCallCount
                });

                if (parsed.type === 'text') {
                    // Done - final answer from LLM
                    this.logEmitter?.emit('info', 'ptk', `Nhận final answer từ LLM (${iteration} iterations, ${toolCallCount} tool calls)`);
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
                    this.logEmitter?.emit('info', 'ptk', `Phát hiện tool call: ${parsed.toolCall?.tool}`);

                    // Check tool call limit
                    if (toolCallCount >= maxToolCalls) {
                        this.logEmitter?.emit('error', 'ptk', `Đạt giới hạn tool calls (${maxToolCalls})`);
                        return {
                            success: false,
                            content: '',
                            error: `Max tool calls limit reached (${maxToolCalls}). Possible infinite loop.`,
                            iterations: iteration,
                            messages,
                            toolCalls,
                            totalToolCalls: toolCallCount,
                            duration: Date.now() - startTime
                        };
                    }

                    // Validate tool call
                    const validation = this.parser.validate(parsed.toolCall!);
                    if (!validation.valid) {
                        return {
                            success: false,
                            content: '',
                            error: `Invalid tool call: ${validation.error}`,
                            iterations: iteration,
                            messages,
                            toolCalls,
                            totalToolCalls: toolCallCount,
                            duration: Date.now() - startTime
                        };
                    }

                    // Check tool exists
                    const tool = toolMap.get(parsed.toolCall!.tool);
                    if (!tool) {
                        return {
                            success: false,
                            content: '',
                            error: `Tool not found: ${parsed.toolCall!.tool}`,
                            iterations: iteration,
                            messages,
                            toolCalls,
                            totalToolCalls: toolCallCount,
                            duration: Date.now() - startTime
                        };
                    }

                    // Duplicate detection
                    if (detectDuplicates && this.isDuplicateToolCall(
                        parsed.toolCall!,
                        toolCalls,
                        duplicateWindow
                    )) {
                        onDuplicateDetected?.(parsed.toolCall!);

                        // Return error instead of continuing loop
                        return {
                            success: false,
                            content: '',
                            error: `Duplicate tool call detected: "${parsed.toolCall!.tool}". Possible infinite loop.`,
                            iterations: iteration,
                            messages,
                            toolCalls,
                            totalToolCalls: toolCallCount,
                            duration: Date.now() - startTime
                        };
                    }

                    onToolCall?.(parsed.toolCall!);

                    // Execute tool (delegate to ToolManager via handler)
                    const argsStr = JSON.stringify(parsed.toolCall!.args).substring(0, 100);
                    this.logEmitter?.emit('info', 'tool', `Executing ${parsed.toolCall!.tool}(${argsStr}...)`);
                    const toolResult = await tool.handler(parsed.toolCall!.args);

                    toolCalls.push(parsed.toolCall!);
                    toolCallCount++;
                    this.logEmitter?.emit('info', 'tool', `Tool ${parsed.toolCall!.tool} completed`);

                    // FALLBACK: If tool execution failed, return error immediately
                    // Don't send back to LLM as it may cause infinite loop
                    if (toolResult.success === false || toolResult.error) {
                        this.logEmitter?.emit('error', 'tool', `Tool ${parsed.toolCall!.tool} failed: ${toolResult.error}`);
                        return {
                            success: false,
                            content: '',
                            error: `Tool "${parsed.toolCall!.tool}" failed: ${toolResult.error || 'Unknown error'}`,
                            iterations: iteration,
                            messages,
                            toolCalls,
                            totalToolCalls: toolCallCount,
                            duration: Date.now() - startTime
                        };
                    }

                    // Add successful result to conversation
                    messages.push({
                        role: 'assistant',
                        content: llmResponse
                    });

                    messages.push({
                        role: 'tool',
                        content: this.formatter.formatToolResult({
                            success: true,
                            data: toolResult.data || toolResult,
                            error: undefined
                        })
                    });

                    // Continue loop - call LLM again with tool result
                }

            } catch (error: any) {
                onError?.(error);
                this.logEmitter?.emit('error', 'ptk', `Error: ${error.message}`);

                return {
                    success: false,
                    content: '',
                    error: error.message || 'Unknown error occurred',
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
            if (recent.tool !== toolCall.tool) {
                return false;
            }

            // Same arguments (deep compare)
            return JSON.stringify(recent.args) === JSON.stringify(toolCall.args);
        });
    }
}
