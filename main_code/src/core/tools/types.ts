/**
 * Common types and interfaces for tool system
 */

/**
 * Base response structure for all tools
 */
export interface ToolResponse {
    success: boolean;
    error?: string;
}

/**
 * Parameters for read_file tool
 */
export interface ReadFileParams {
    path: string;  // Absolute or relative path to file
}

/**
 * Response from read_file tool
 */
export interface ReadFileResponse extends ToolResponse {
    data?: string;           // File content
    metadata?: {
        size: number;        // File size in bytes
        encoding: string;    // 'utf-8'
        lines: number;       // Number of lines
    };
    accessDenied?: boolean;
    deniedPath?: string;
}
