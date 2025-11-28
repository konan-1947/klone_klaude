/**
 * Context Builder - Build workspace context for AI
 */

import { IgnoreManager } from '../ignore/IgnoreManager';
import { WorkspaceContext, FileTreeNode, ContextBuildOptions } from './types';
import fs from 'fs/promises';
import path from 'path';

export class ContextBuilder {
    constructor(
        private workspacePath: string,
        private ignoreManager: IgnoreManager
    ) { }

    /**
     * Build workspace context
     */
    async buildContext(options: ContextBuildOptions = {}): Promise<WorkspaceContext> {
        const {
            maxDepth = 3,
            includeIgnored = false,
            format = 'tree'
        } = options;

        // 1. Scan workspace to build tree
        const tree = await this.buildTree(this.workspacePath, 0, maxDepth, includeIgnored);

        // 2. Calculate statistics
        const stats = this.calculateStats(tree);

        // 3. Generate summary
        const summary = this.generateSummary(tree, stats);

        return {
            tree,
            stats,
            summary
        };
    }

    /**
     * Build file tree recursively
     */
    private async buildTree(
        dirPath: string,
        currentDepth: number,
        maxDepth: number,
        includeIgnored: boolean
    ): Promise<FileTreeNode> {
        const name = path.basename(dirPath);

        // Check if ignored
        const relativePath = path.relative(this.workspacePath, dirPath);
        if (!includeIgnored && relativePath && !this.ignoreManager.validateAccess(relativePath)) {
            return {
                name,
                type: 'directory',
                path: relativePath,
                children: []
            };
        }

        const stats = await fs.stat(dirPath);

        if (stats.isFile()) {
            return {
                name,
                type: 'file',
                path: relativePath,
                size: stats.size
            };
        }

        // Directory
        if (currentDepth >= maxDepth) {
            return {
                name,
                type: 'directory',
                path: relativePath,
                children: []
            };
        }

        const entries = await fs.readdir(dirPath);
        const children: FileTreeNode[] = [];

        for (const entry of entries) {
            const fullPath = path.join(dirPath, entry);
            try {
                const child = await this.buildTree(fullPath, currentDepth + 1, maxDepth, includeIgnored);
                children.push(child);
            } catch (error) {
                // Skip files that can't be accessed
                continue;
            }
        }

        return {
            name,
            type: 'directory',
            path: relativePath,
            children
        };
    }

    /**
     * Calculate workspace statistics
     */
    private calculateStats(tree: FileTreeNode): WorkspaceContext['stats'] {
        const stats = {
            totalFiles: 0,
            totalDirs: 0,
            languages: {} as Record<string, number>
        };

        const traverse = (node: FileTreeNode) => {
            if (node.type === 'file') {
                stats.totalFiles++;

                // Count by extension
                const ext = path.extname(node.name).slice(1);
                if (ext) {
                    stats.languages[ext] = (stats.languages[ext] || 0) + 1;
                }
            } else {
                stats.totalDirs++;
                node.children?.forEach(traverse);
            }
        };

        traverse(tree);
        return stats;
    }

    /**
     * Generate human-readable summary
     */
    private generateSummary(tree: FileTreeNode, stats: WorkspaceContext['stats']): string {
        const lines = [
            `Workspace: ${tree.name}`,
            `Files: ${stats.totalFiles}`,
            `Directories: ${stats.totalDirs}`,
            ``,
            `Languages:`,
            ...Object.entries(stats.languages)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5)
                .map(([ext, count]) => `  - ${ext}: ${count} files`)
        ];

        return lines.join('\n');
    }

    /**
     * Format tree as string (for AI prompt)
     */
    formatTree(tree: FileTreeNode, indent: string = ''): string {
        const lines: string[] = [];

        const isLast = true; // Simplified
        const prefix = indent + (isLast ? '└── ' : '├── ');

        lines.push(prefix + tree.name);

        if (tree.children) {
            const childIndent = indent + (isLast ? '    ' : '│   ');
            for (const child of tree.children) {
                lines.push(this.formatTree(child, childIndent));
            }
        }

        return lines.join('\n');
    }
}
