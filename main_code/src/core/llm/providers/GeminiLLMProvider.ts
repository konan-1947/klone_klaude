/**
 * Gemini LLM Provider - Fast preprocessing với Gemini Flash
 */

import { ILLMManager } from '../ILLMManager';
import { LLMOptions } from '../../ptk/types';
import { LogEmitter } from '../../logging';

export interface GeminiConfig {
    apiKey: string;
    model?: string; // Default: 'gemini-1.5-flash'
    logEmitter?: LogEmitter;
}

export class GeminiLLMProvider implements ILLMManager {
    private apiKey: string;
    private model: string;
    private logEmitter?: LogEmitter;

    constructor(config: GeminiConfig) {
        this.apiKey = config.apiKey;
        this.model = config.model || 'gemini-2.5-flash-lite';
        this.logEmitter = config.logEmitter;
    }

    async call(prompt: string, options?: LLMOptions): Promise<string> {
        const model = options?.model || this.model;
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.apiKey}`;

        try {
            this.logEmitter?.emit('info', 'llm', `Gemini: Sending request to ${model} (${prompt.length} chars)`);

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [{
                            text: prompt
                        }]
                    }],
                    generationConfig: {
                        temperature: options?.temperature || 0.1,
                        maxOutputTokens: options?.maxTokens || 1000
                    }
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                this.logEmitter?.emit('error', 'llm', `Gemini API error (${response.status}): ${errorText}`);
                throw new Error(`Gemini API error (${response.status}): ${errorText}`);
            }

            const data = await response.json();
            const result = data.candidates[0].content.parts[0].text;
            this.logEmitter?.emit('info', 'llm', `Gemini: Received response (${result.length} chars)`);
            return result;
        } catch (error: any) {
            this.logEmitter?.emit('error', 'llm', `Gemini call failed: ${error.message}`);
            throw error;
        }
    }
}
