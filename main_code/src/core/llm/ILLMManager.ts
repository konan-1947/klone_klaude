/**
 * LLM Manager Interface
 */

import { LLMOptions } from '../ptk/types';

/**
 * Interface for LLM providers
 */
export interface ILLMManager {
    /**
     * Call LLM with prompt
     * @param prompt - The prompt to send
     * @param options - LLM options
     * @returns LLM response as string
     */
    call(prompt: string, options?: LLMOptions): Promise<string>;
}
