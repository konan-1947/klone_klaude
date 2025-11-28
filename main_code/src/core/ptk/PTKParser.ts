/**
 * PTKParser - Parse LLM responses and extract tool calls
 */

import { PTKResponse, PTKToolCall, PTKValidation } from './types';
import { PTKExecutionError, PTKErrorCode } from './errors';

export class PTKParser {
    /**
     * Parse LLM response to detect text or tool call
     */
    parse(response: string): PTKResponse {
        const toolCall = this.extract(response);

        if (!toolCall) {
            return {
                type: 'text',
                content: response.trim(),
                raw: response
            };
        }

        return {
            type: 'tool_call',
            toolCall: toolCall,
            raw: response
        };
    }

    /**
     * Extract tool call from response
     */
    extract(response: string): PTKToolCall | null {
        // Regex to match <PTK_CALL>...</PTK_CALL>
        const callMatch = response.match(/<PTK_CALL>(.*?)<\/PTK_CALL>/s);

        if (!callMatch) {
            return null;
        }

        try {
            const jsonStr = callMatch[1].trim();
            const toolCall = JSON.parse(jsonStr);

            // Validate basic structure
            if (!toolCall.tool || typeof toolCall.tool !== 'string') {
                throw new Error('Missing or invalid "tool" field');
            }

            if (!toolCall.args || typeof toolCall.args !== 'object') {
                throw new Error('Missing or invalid "args" field');
            }

            return {
                tool: toolCall.tool,
                args: toolCall.args,
                reasoning: toolCall.reasoning
            };

        } catch (error: any) {
            throw new PTKExecutionError(
                `Failed to parse tool call JSON: ${error.message}`,
                PTKErrorCode.PARSE_ERROR,
                { rawContent: callMatch[1] }
            );
        }
    }

    /**
     * Validate tool call format
     */
    validate(toolCall: PTKToolCall): PTKValidation {
        // Check tool name
        if (!toolCall.tool || typeof toolCall.tool !== 'string') {
            return {
                valid: false,
                error: 'Tool name must be a non-empty string'
            };
        }

        // Check args
        if (!toolCall.args || typeof toolCall.args !== 'object') {
            return {
                valid: false,
                error: 'Tool args must be an object'
            };
        }

        // Check args is not array
        if (Array.isArray(toolCall.args)) {
            return {
                valid: false,
                error: 'Tool args cannot be an array'
            };
        }

        return {
            valid: true
        };
    }
}
