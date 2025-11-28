/**
 * Tool Registry - Register and manage PTK tools
 */

import { PTKTool } from '../ptk/types';
import { ToolManager } from './ToolManager';
import { readFileTool } from './definitions';

export class ToolRegistry {
    private tools: Map<string, PTKTool>;

    constructor(private toolManager: ToolManager) {
        this.tools = new Map();
        this.registerDefaultTools();
    }

    /**
     * Register default tools
     */
    private registerDefaultTools(): void {
        this.register(readFileTool);
    }

    /**
     * Register a tool with real handler
     */
    register(tool: PTKTool): void {
        // Inject real handler that calls ToolManager
        const toolWithHandler: PTKTool = {
            ...tool,
            handler: async (args) => {
                const result = await this.toolManager.execute(tool.name, args);
                return result;
            }
        };

        this.tools.set(tool.name, toolWithHandler);
    }

    /**
     * Get a tool by name
     */
    get(name: string): PTKTool | undefined {
        return this.tools.get(name);
    }

    /**
     * Get all registered tools
     */
    getAll(): PTKTool[] {
        return Array.from(this.tools.values());
    }

    /**
     * Check if a tool is registered
     */
    has(name: string): boolean {
        return this.tools.has(name);
    }

    /**
     * Get list of tool names
     */
    getNames(): string[] {
        return Array.from(this.tools.keys());
    }
}
