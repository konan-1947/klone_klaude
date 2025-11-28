/**
 * PTKFormatter - Format prompts and messages for PTK protocol
 */

import { PTKTool, PTKMessage, PTKToolResult } from './types';

export class PTKFormatter {
    /**
     * Format system prompt with tool definitions
     */
    formatSystemPrompt(tools: PTKTool[]): string {
        const toolDefs = this.formatToolDefinitions(tools);

        return `You are a helpful AI assistant with access to the following tools:

${toolDefs}

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
- Only use ONE tool call per response`;
    }

    /**
     * Format tool definitions as markdown
     */
    formatToolDefinitions(tools: PTKTool[]): string {
        if (tools.length === 0) {
            return 'No tools available.';
        }

        return tools.map(tool => {
            const params = Object.entries(tool.parameters.properties)
                .map(([name, param]) => {
                    const required = tool.parameters.required?.includes(name) ? ' (required)' : '';
                    return `    - ${name}: ${param.type}${required} - ${param.description}`;
                })
                .join('\n');

            return `• ${tool.name}: ${tool.description}
  Parameters:
${params}`;
        }).join('\n\n');
    }

    /**
     * Format conversation history
     */
    formatConversation(messages: PTKMessage[]): string {
        return messages.map(msg => {
            switch (msg.role) {
                case 'system':
                    return `SYSTEM:\n${msg.content}`;
                case 'user':
                    return `USER:\n${msg.content}`;
                case 'assistant':
                    return `ASSISTANT:\n${msg.content}`;
                case 'tool':
                    return `TOOL RESULT:\n${msg.content}`;
                default:
                    return msg.content;
            }
        }).join('\n\n---\n\n');
    }

    /**
     * Format tool result to send back to LLM
     */
    formatToolResult(result: PTKToolResult): string {
        if (result.success) {
            const data = typeof result.data === 'string'
                ? result.data
                : JSON.stringify(result.data, null, 2);

            return `PTK_RESULT: Tool executed successfully
${data}`;
        } else {
            return `PTK_RESULT: Tool execution failed
Error: ${result.error}`;
        }
    }
}
