/**
 * Groq LLM Provider - Fast, cheap AI for preprocessing
 */

import { ILLMManager } from '../ILLMManager';
import { LLMOptions } from '../../ptk/types';

export interface GroqConfig {
    apiKey: string;
    model?: string; // Default: 'llama-3.3-70b-versatile'
    baseURL?: string;
}

export class GroqLLMProvider implements ILLMManager {
    private apiKey: string;
    private model: string;
    private baseURL: string;

    constructor(config: GroqConfig) {
        this.apiKey = config.apiKey;
        this.model = config.model || 'llama-3.3-70b-versatile';
        this.baseURL = config.baseURL || 'https://api.groq.com/openai/v1';
    }

    async call(prompt: string, options?: LLMOptions): Promise<string> {
        const response = await fetch(`${this.baseURL}/chat/completions`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: options?.model || this.model,
                messages: [
                    { role: 'user', content: prompt }
                ],
                temperature: options?.temperature || 0.1,
                max_tokens: options?.maxTokens || 1000
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Groq API error (${response.status}): ${errorText}`);
        }

        const data = await response.json();
        return data.choices[0].message.content;
    }
}
