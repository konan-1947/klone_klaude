/**
 * Batch File Reader - Read multiple files efficiently
 */

import { ToolManager } from './ToolManager';
import { ReadFileResponse } from './types';

export interface FileContent {
    path: string;
    content: string;
    success: boolean;
    error?: string;
}

export class BatchFileReader {
    constructor(private toolManager: ToolManager) { }

    /**
     * Read multiple files at once
     */
    async readFiles(paths: string[]): Promise<FileContent[]> {
        const results = await Promise.all(
            paths.map(async (path) => {
                try {
                    const result = await this.toolManager.execute('read_file', { path }) as ReadFileResponse;

                    if (result.success && result.data) {
                        return {
                            path,
                            content: result.data,
                            success: true
                        };
                    } else {
                        return {
                            path,
                            content: '',
                            success: false,
                            error: result.error
                        };
                    }
                } catch (error: any) {
                    return {
                        path,
                        content: '',
                        success: false,
                        error: error.message
                    };
                }
            })
        );

        return results;
    }

    /**
     * Format file contents for AI prompt
     */
    formatForPrompt(files: FileContent[]): string {
        return files
            .filter(f => f.success)
            .map(f => {
                return `### File: ${f.path}\n\`\`\`\n${f.content}\n\`\`\``;
            })
            .join('\n\n');
    }
}
