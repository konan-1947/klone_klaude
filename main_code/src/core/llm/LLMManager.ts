/**
 * LLM Manager - Manages multiple LLM providers
 */

import { ILLMManager } from './ILLMManager';
import { LLMOptions } from '../ptk/types';

export type LLMProvider = 'ai-studio' | 'groq' | 'gemini' | 'openai';

export class LLMManager implements ILLMManager {
    private providers: Map<LLMProvider, ILLMManager>;
    private currentProvider: LLMProvider;

    constructor() {
        this.providers = new Map();
        this.currentProvider = 'ai-studio';
    }

    /**
     * Register an LLM provider
     */
    registerProvider(name: LLMProvider, provider: ILLMManager): void {
        this.providers.set(name, provider);
    }

    /**
     * Set the active provider
     */
    setProvider(name: LLMProvider): void {
        if (!this.providers.has(name)) {
            throw new Error(`Provider ${name} is not registered`);
        }
        this.currentProvider = name;
    }

    /**
     * Get current provider name
     */
    getCurrentProvider(): LLMProvider {
        return this.currentProvider;
    }

    /**
     * Call LLM using current provider
     */
    async call(prompt: string, options?: LLMOptions): Promise<string> {
        const provider = this.providers.get(this.currentProvider);

        if (!provider) {
            throw new Error(`Provider ${this.currentProvider} not registered`);
        }

        return await provider.call(prompt, options);
    }
}
