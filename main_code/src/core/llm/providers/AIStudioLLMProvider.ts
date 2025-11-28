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
            // AI Studio Browser doesn't support options yet
            // Options will be used in future for model selection, temperature, etc.
            const response = await this.aiStudioBrowser.sendPrompt(prompt);
            return response;
        } catch (error: any) {
            throw new Error(`AI Studio call failed: ${error.message}`);
        }
    }
}
