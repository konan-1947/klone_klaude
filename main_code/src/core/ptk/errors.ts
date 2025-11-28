/**
 * PTK Error Codes
 */
export enum PTKErrorCode {
    TOOL_NOT_FOUND = 'TOOL_NOT_FOUND',
    INVALID_TOOL_CALL = 'INVALID_TOOL_CALL',
    MAX_ITERATIONS_REACHED = 'MAX_ITERATIONS_REACHED',
    MAX_TOOL_CALLS_REACHED = 'MAX_TOOL_CALLS_REACHED',
    TOOL_EXECUTION_FAILED = 'TOOL_EXECUTION_FAILED',
    LLM_CALL_FAILED = 'LLM_CALL_FAILED',
    PARSE_ERROR = 'PARSE_ERROR',
    DUPLICATE_TOOL_CALL = 'DUPLICATE_TOOL_CALL'
}

/**
 * PTK Execution Error
 */
export class PTKExecutionError extends Error {
    constructor(
        message: string,
        public code: PTKErrorCode,
        public context?: any
    ) {
        super(message);
        this.name = 'PTKExecutionError';
    }
}
