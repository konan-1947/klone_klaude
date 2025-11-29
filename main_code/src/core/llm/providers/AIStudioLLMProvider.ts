/**
 * AI Studio LLM Provider
 * Wraps AIStudioBrowser to implement ILLMManager interface
 */

import { ILLMManager } from '../ILLMManager';
import { LLMOptions } from '../../ptk/types';
import { AIStudioBrowser } from '../../browser/AIStudioBrowser';

export class AIStudioLLMProvider implements ILLMManager {
    constructor(private aiStudioBrowser: AIStudioBrowser) { }

    async call(prompt: string, options?: LLMOptions): Promise<string> {
        try {
            // Check if upload mode is requested and has file contents
            if (options?.mode === 'upload' && options.fileContents && options.fileContents.length > 0) {
                // Use upload mode
                const response = await this.aiStudioBrowser.sendPromptWithFile(
                    prompt,
                    options.fileContents,
                    options.workspaceSummary || ''
                );
                return response;
            }

            // Otherwise use inline mode (default)
            const response = await this.aiStudioBrowser.sendPrompt(prompt);
            return response;
        } catch (error: any) {
            throw new Error(`AI Studio call failed: ${error.message}`);
        }
    }
}
