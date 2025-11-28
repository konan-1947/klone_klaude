/**
 * Category of ignored files
 */
export type IgnoreCategory =
    | 'dependencies'
    | 'environment'
    | 'build'
    | 'cache'
    | 'vcs'
    | 'ide'
    | 'large';

/**
 * Result of access validation
 */
export interface ValidationResult {
    allowed: boolean;
    reason?: string;
    category?: IgnoreCategory;
}

/**
 * Result of project scan
 */
export interface ScanResult {
    categories: Map<IgnoreCategory, string[]>;
    largeFolders: string[];
    totalPatterns: number;
}

/**
 * Pattern with metadata
 */
export interface IgnorePattern {
    pattern: string;
    category: IgnoreCategory;
    autoDetected: boolean;
}
