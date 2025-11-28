/**
 * Base handler class for all tool implementations
 */

import path from 'path';
import { IgnoreManager } from '../../ignore/IgnoreManager';
import { AccessDeniedError } from '../errors';
import { ToolResponse } from '../types';

/**
 * Abstract base class for all tool handlers
 */
export abstract class BaseHandler {
    constructor(
        protected cwd: string,
        protected ignoreManager: IgnoreManager
    ) { }

    /**
     * Execute the tool with given parameters
     */
    abstract execute(params: any): Promise<ToolResponse>;

    /**
     * Resolve relative path to absolute path based on cwd
     */
    protected resolveAbsolutePath(filePath: string): string {
        return path.resolve(this.cwd, filePath);
    }

    /**
     * Validate file access using IgnoreManager
     * @throws AccessDeniedError if access is denied
     */
    protected validateAccess(filePath: string): void {
        if (!this.ignoreManager.validateAccess(filePath)) {
            throw new AccessDeniedError(filePath);
        }
    }
}
