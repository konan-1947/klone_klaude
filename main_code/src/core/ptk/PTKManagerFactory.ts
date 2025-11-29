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
    geminiManager?: LLMManager; // Required for optimized mode
}

export class PTKManagerFactory {
    static create(options: PTKFactoryOptions): IPTKManager {
        const {
            mode,
            workspacePath,
            ignoreManager,
            llmManager,
            geminiManager
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
            if (!geminiManager) {
                throw new Error('Gemini manager required for optimized mode');
            }

            const toolManager = new ToolManager(workspacePath, ignoreManager);
            const contextBuilder = new ContextBuilder(workspacePath, ignoreManager);
            const batchReader = new BatchFileReader(toolManager);

            return new OptimizedPTKManager(
                contextBuilder,
                geminiManager,
                llmManager,
                batchReader
            );
        }

        throw new Error(`Unknown PTK mode: ${mode}`);
    }
}
