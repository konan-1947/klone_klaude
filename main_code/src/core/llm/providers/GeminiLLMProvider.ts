/**
 * Gemini LLM Provider - Fast preprocessing với Gemini Flash
 */

import { ILLMManager } from '../ILLMManager';
import { LLMOptions } from '../../ptk/types';

export interface GeminiConfig {
    apiKey: string;
    model?: string; // Default: 'gemini-1.5-flash'
}

export class GeminiLLMProvider implements ILLMManager {
    private apiKey: string;
    private model: string;

    constructor(config: GeminiConfig) {
        this.apiKey = config.apiKey;
        this.model = config.model || 'gemini-2.5-flash-lite';
    }

    async call(prompt: string, options?: LLMOptions): Promise<string> {
        const model = options?.model || this.model;
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.apiKey}`;

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
            throw new Error(`Gemini API error (${response.status}): ${errorText}`);
        }

        const data = await response.json();
        return data.candidates[0].content.parts[0].text;
    }
}
