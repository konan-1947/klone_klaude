/**
 * Custom error classes for tool operations
 */

/**
 * Error thrown when access to a file is denied
 */
export class AccessDeniedError extends Error {
    constructor(public filePath: string) {
        super(`Access denied: ${filePath}`);
        this.name = 'AccessDeniedError';
    }
}

/**
 * General tool operation error
 */
export class ToolError extends Error {
    constructor(
        message: string,
        public code: string
    ) {
        super(message);
        this.name = 'ToolError';
    }
}
