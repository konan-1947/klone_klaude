/**
 * Handler for read_file tool
 */

import fs from 'fs/promises';
import { BaseHandler } from './BaseHandler';
import { AccessDeniedError } from '../errors';
import { ReadFileParams, ReadFileResponse } from '../types';

/**
 * Read file content with security validation
 */
export class ReadFileHandler extends BaseHandler {
    async execute(params: ReadFileParams): Promise<ReadFileResponse> {
        try {
            // 1. Validate params
            if (!params.path) {
                return {
                    success: false,
                    error: 'Parameter "path" is required'
                };
            }

            // 2. Resolve absolute path
            const absolutePath = this.resolveAbsolutePath(params.path);

            // 3. Validate access với IgnoreManager
            try {
                this.validateAccess(params.path);
            } catch (error) {
                if (error instanceof AccessDeniedError) {
                    return {
                        success: false,
                        error: `Access denied: File is ignored by .aiignore`,
                        accessDenied: true,
                        deniedPath: params.path
                    };
                }
                throw error;
            }

            // 4. Check if file exists và is file
            let stats;
            try {
                stats = await fs.stat(absolutePath);
            } catch (error: any) {
                if (error.code === 'ENOENT') {
                    return {
                        success: false,
                        error: `File not found: ${params.path}`
                    };
                }
                throw error;
            }

            if (stats.isDirectory()) {
                return {
                    success: false,
                    error: `Path is a directory, not a file: ${params.path}. Use list_files instead.`
                };
            }

            // 5. Warn if file is large
            const MAX_SIZE = 1024 * 1024; // 1MB
            if (stats.size > MAX_SIZE) {
                console.warn(`[ReadFileHandler] Large file detected: ${params.path} (${stats.size} bytes)`);
            }

            // 6. Read file content
            const content = await fs.readFile(absolutePath, 'utf-8');

            // 7. Calculate metadata
            const lines = content.split('\n').length;

            return {
                success: true,
                data: content,
                metadata: {
                    size: stats.size,
                    encoding: 'utf-8',
                    lines
                }
            };

        } catch (error: any) {
            // Handle other errors
            if (error.code === 'EACCES') {
                return {
                    success: false,
                    error: `Permission denied: ${params.path}`
                };
            }

            return {
                success: false,
                error: error.message || 'Unknown error occurred'
            };
        }
    }
}
