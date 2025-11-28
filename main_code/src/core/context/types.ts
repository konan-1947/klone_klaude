/**
 * Workspace context types
 */

export interface WorkspaceContext {
    // File tree
    tree: FileTreeNode;

    // Statistics
    stats: {
        totalFiles: number;
        totalDirs: number;
        languages: Record<string, number>; // e.g., {"ts": 50, "json": 10}
    };

    // Summary
    summary: string; // Human-readable summary
}

export interface FileTreeNode {
    name: string;
    type: 'file' | 'directory';
    path: string;
    children?: FileTreeNode[];
    size?: number;
}

export interface ContextBuildOptions {
    maxDepth?: number;       // Default: 3
    includeIgnored?: boolean; // Default: false
    format?: 'tree' | 'list'; // Default: 'tree'
}
