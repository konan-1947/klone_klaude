/**
 * Central manager for tool registration and execution
 */

import { BaseHandler } from './handlers/BaseHandler';
import { ReadFileHandler } from './handlers/ReadFileHandler';
import { IgnoreManager } from '../ignore/IgnoreManager';
import { ToolResponse } from './types';

/**
 * Manages tool registration and execution
 */
export class ToolManager {
    private handlers = new Map<string, BaseHandler>();

    constructor(
        private cwd: string,
        private ignoreManager: IgnoreManager
    ) {
        this.registerDefaultTools();
    }

    /**
     * Register all default tools
     */
    private registerDefaultTools(): void {
        // Register read_file
        this.handlers.set(
            'read_file',
            new ReadFileHandler(this.cwd, this.ignoreManager)
        );
    }

    /**
     * Execute a tool by name with given parameters
     */
    async execute(toolName: string, params: any): Promise<ToolResponse> {
        const handler = this.handlers.get(toolName);

        if (!handler) {
            return {
                success: false,
                error: `Unknown tool: ${toolName}`
            };
        }

        return await handler.execute(params);
    }

    /**
     * Get list of registered tool names
     */
    getRegisteredTools(): string[] {
        return Array.from(this.handlers.keys());
    }

    /**
     * Check if a tool is registered
     */
    hasTool(toolName: string): boolean {
        return this.handlers.has(toolName);
    }
}
