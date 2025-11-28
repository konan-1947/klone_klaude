/**
 * PTK Manager Interface
 * Common interface for Standard and Optimized PTK implementations
 */

import { PTKExecuteOptions, PTKExecuteResult } from './types';

export interface IPTKManager {
    /**
     * Orchestrate tool calling workflow
     * @param prompt - User prompt
     * @param options - Execution options
     * @returns Result with answer and metadata
     */
    orchestrateToolCalling(
        prompt: string,
        options?: PTKExecuteOptions
    ): Promise<PTKExecuteResult>;
}
