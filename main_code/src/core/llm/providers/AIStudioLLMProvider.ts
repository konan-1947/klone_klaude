/**
 * AI Studio LLM Provider
 * Wraps AIStudioBrowser to implement ILLMManager interface
 */

import { ILLMManager } from '../ILLMManager';
import { LLMOptions } from '../../ptk/types';
import { AIStudioBrowser } from '../../browser/AIStudioBrowser';
import { LogEmitter } from '../../logging';

export class AIStudioLLMProvider implements ILLMManager {
    constructor(
        private aiStudioBrowser: AIStudioBrowser,
        private logEmitter?: LogEmitter
    ) { }

    async call(prompt: string, options?: LLMOptions): Promise<string> {
        try {
            // Show browser window để lấy focus
            await this.aiStudioBrowser.showWindow();

            // Check if upload mode is requested and has file contents
            if (options?.mode === 'upload' && options.fileContents && options.fileContents.length > 0) {
                // Use upload mode
                this.logEmitter?.emit('info', 'llm', `AI Studio: Sending prompt with ${options.fileContents.length} files (upload mode)`);

                const response = await this.aiStudioBrowser.sendPromptWithFile(
                    prompt,
                    options.fileContents,
                    options.workspaceSummary || ''
                );
                this.logEmitter?.emit('info', 'llm', `AI Studio: Received response (${response.length} chars)`);

                // Thu nhỏ browser sau khi đã nhận hết kết quả
                this.aiStudioBrowser.minimizeWindow().catch(err => {
                    this.logEmitter?.emit('warning', 'llm', `Failed to minimize: ${err.message}`);
                });

                return response;
            }

            // Otherwise use inline mode (default)
            this.logEmitter?.emit('info', 'llm', `AI Studio: Sending prompt (inline mode, ${prompt.length} chars)`);

            const response = await this.aiStudioBrowser.sendPrompt(prompt);
            this.logEmitter?.emit('info', 'llm', `AI Studio: Received response (${response.length} chars)`);

            // Thu nhỏ browser sau khi đã nhận hết kết quả
            this.aiStudioBrowser.minimizeWindow().catch(err => {
                this.logEmitter?.emit('warning', 'llm', `Failed to minimize: ${err.message}`);
            });

            return response;
        } catch (error: any) {
            this.logEmitter?.emit('error', 'llm', `AI Studio call failed: ${error.message}`);
            throw new Error(`AI Studio call failed: ${error.message}`);
        }
    }
}
