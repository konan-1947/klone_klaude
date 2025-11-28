import chokidar, { FSWatcher } from 'chokidar';
import fs from 'fs/promises';
import ignore, { Ignore } from 'ignore';
import path from 'path';
import { IgnoreCategory, ScanResult } from './types';
import { KNOWN_PATTERNS, SIZE_THRESHOLD_BYTES } from './constants';

export const LOCK_TEXT_SYMBOL = '\u{1F512}';

/**
 * Helper function to check if file exists
 */
async function fileExistsAtPath(filePath: string): Promise<boolean> {
    try {
        await fs.access(filePath);
        return true;
    } catch {
        return false;
    }
}

/**
 * Helper to check if path is a directory
 */
async function isDirectory(filePath: string): Promise<boolean> {
    try {
        const stats = await fs.stat(filePath);
        return stats.isDirectory();
    } catch {
        return false;
    }
}

/**
 * Helper to convert Windows paths to POSIX
 */
function toPosix(filePath: string): string {
    return filePath.split(path.sep).join('/');
}

/**
 * Controls LLM access to files by enforcing ignore patterns.
 * Uses the 'ignore' library to support standard .gitignore syntax in .aiignore files.
 * 
 * Enhanced version with auto-detection capabilities.
 */
export class IgnoreManager {
    private cwd: string;
    private ignoreInstance: Ignore;
    private fileWatcher?: FSWatcher;
    aiIgnoreContent: string | undefined;

    constructor(cwd: string) {
        this.cwd = cwd;
        this.ignoreInstance = ignore();
        this.aiIgnoreContent = undefined;
    }

    /**
     * Initialize the manager by loading custom patterns and setting up file watcher
     * Must be called after construction and before using the manager
     */
    async initialize(): Promise<void> {
        // Set up file watcher for .aiignore
        this.setupFileWatcher();
        await this.loadAiIgnore();
    }

    /**
     * Set up the file watcher for .aiignore changes
     */
    private setupFileWatcher(): void {
        const ignorePath = path.join(this.cwd, '.aiignore');

        this.fileWatcher = chokidar.watch(ignorePath, {
            persistent: true, // Keep the process running as long as files are being watched
            ignoreInitial: true, // Don't fire 'add' events when discovering the file initially
            awaitWriteFinish: {
                // Wait for writes to finish before emitting events (handles chunked writes)
                stabilityThreshold: 100, // Wait 100ms for file size to remain constant
                pollInterval: 100, // Check file size every 100ms while waiting for stability
            },
            atomic: true, // Handle atomic writes where editors write to a temp file then rename
        });

        // Watch for file changes, creation, and deletion
        this.fileWatcher.on('change', () => {
            this.loadAiIgnore();
        });

        this.fileWatcher.on('add', () => {
            this.loadAiIgnore();
        });

        this.fileWatcher.on('unlink', () => {
            this.loadAiIgnore();
        });

        this.fileWatcher.on('error', (error) => {
            console.error('Error watching .aiignore file:', error);
        });
    }

    /**
     * Load custom patterns from .aiignore if it exists.
     * Supports "!include <filename>" to load additional ignore patterns from other files.
     */
    private async loadAiIgnore(): Promise<void> {
        try {
            // Reset ignore instance to prevent duplicate patterns
            this.ignoreInstance = ignore();
            const ignorePath = path.join(this.cwd, '.aiignore');

            if (await fileExistsAtPath(ignorePath)) {
                const content = await fs.readFile(ignorePath, 'utf8');
                this.aiIgnoreContent = content;
                await this.processIgnoreContent(content);
                this.ignoreInstance.add('.aiignore');
            } else {
                this.aiIgnoreContent = undefined;
            }
        } catch (error) {
            // Should never happen: reading file failed even though it exists
            console.error('Unexpected error loading .aiignore:', error);
        }
    }

    /**
     * Process ignore content and apply all ignore patterns
     */
    private async processIgnoreContent(content: string): Promise<void> {
        // Optimization: first check if there are any !include directives
        if (!content.includes('!include ')) {
            this.ignoreInstance.add(content);
            return;
        }

        // Process !include directives
        const combinedContent = await this.processAiIgnoreIncludes(content);
        this.ignoreInstance.add(combinedContent);
    }

    /**
     * Process !include directives and combine all included file contents
     */
    private async processAiIgnoreIncludes(content: string): Promise<string> {
        let combinedContent = '';
        const lines = content.split(/\r?\n/);

        for (const line of lines) {
            const trimmedLine = line.trim();

            if (!trimmedLine.startsWith('!include ')) {
                combinedContent += '\n' + line;
                continue;
            }

            // Process !include directive
            const includedContent = await this.readIncludedFile(trimmedLine);
            if (includedContent) {
                combinedContent += '\n' + includedContent;
            }
        }

        return combinedContent;
    }

    /**
     * Read content from an included file specified by !include directive
     */
    private async readIncludedFile(includeLine: string): Promise<string | null> {
        const includePath = includeLine.substring('!include '.length).trim();
        const resolvedIncludePath = path.join(this.cwd, includePath);

        if (!(await fileExistsAtPath(resolvedIncludePath))) {
            console.debug(`[IgnoreManager] Included file not found: ${resolvedIncludePath} `);
            return null;
        }

        return await fs.readFile(resolvedIncludePath, 'utf8');
    }

    /**
     * Check if a file should be accessible to the LLM
     * @param filePath - Path to check (relative to cwd)
     * @returns true if file is accessible, false if ignored
     */
    validateAccess(filePath: string): boolean {
        // Always allow access if .aiignore does not exist
        if (!this.aiIgnoreContent) {
            return true;
        }

        try {
            // Normalize path to be relative to cwd and use forward slashes
            const absolutePath = path.resolve(this.cwd, filePath);
            const relativePath = toPosix(path.relative(this.cwd, absolutePath));

            // Ignore expects paths to be path.relative()'d
            return !this.ignoreInstance.ignores(relativePath);
        } catch (_error) {
            // Ignore is designed to work with relative file paths, so will throw error for paths outside cwd. 
            // We are allowing access to all files outside cwd.
            return true;
        }
    }

    /**
     * Check if a terminal command should be allowed to execute based on file access patterns
     * @param command - Terminal command to validate
     * @returns path of file that is being accessed if it is being accessed, undefined if command is allowed
     */
    validateCommand(command: string): string | undefined {
        // Always allow if no .aiignore exists
        if (!this.aiIgnoreContent) {
            return undefined;
        }

        // Split command into parts and get the base command
        const parts = command.trim().split(/\s+/);
        const baseCommand = parts[0].toLowerCase();

        // Commands that read file contents
        const fileReadingCommands = [
            // Unix commands
            'cat',
            'less',
            'more',
            'head',
            'tail',
            'grep',
            'awk',
            'sed',
            // PowerShell commands and aliases
            'get-content',
            'gc',
            'type',
            'select-string',
            'sls',
        ];

        if (fileReadingCommands.includes(baseCommand)) {
            // Check each argument that could be a file path
            for (let i = 1; i < parts.length; i++) {
                const arg = parts[i];
                // Skip command flags/options (both Unix and PowerShell style)
                if (arg.startsWith('-') || arg.startsWith('/')) {
                    continue;
                }
                // Ignore PowerShell parameter names
                if (arg.includes(':')) {
                    continue;
                }
                // Validate file access
                if (!this.validateAccess(arg)) {
                    return arg;
                }
            }
        }

        return undefined;
    }

    /**
     * Filter an array of paths, removing those that should be ignored
     * @param paths - Array of paths to filter (relative to cwd)
     * @returns Array of allowed paths
     */
    filterPaths(paths: string[]): string[] {
        try {
            return paths
                .map((p) => ({
                    path: p,
                    allowed: this.validateAccess(p),
                }))
                .filter((x) => x.allowed)
                .map((x) => x.path);
        } catch (error) {
            console.error('Error filtering paths:', error);
            return []; // Fail closed for security
        }
    }

    // ========================================
    // AUTO-DETECTION METHODS (Day 2)
    // ========================================

    /**
     * Scan project directory to auto-detect ignore patterns
     * @returns Scan result with categorized patterns
     */
    async scanProject(): Promise<ScanResult> {
        const categories = new Map<IgnoreCategory, string[]>();
        const patterns: string[] = [];

        // Initialize all categories
        (['dependencies', 'environment', 'build', 'cache', 'vcs', 'ide'] as IgnoreCategory[]).forEach(cat => {
            categories.set(cat, []);
        });

        try {
            const entries = await fs.readdir(this.cwd, { withFileTypes: true });

            for (const entry of entries) {
                const entryPath = path.join(this.cwd, entry.name);

                if (entry.isDirectory()) {
                    // Check against known patterns for each category
                    for (const [category, knownPatterns] of Object.entries(KNOWN_PATTERNS)) {
                        if (knownPatterns.includes(entry.name)) {
                            const pattern = entry.name + '/';
                            categories.get(category as IgnoreCategory)?.push(pattern);
                            patterns.push(pattern);
                            break;
                        }
                    }
                } else {
                    // Check environment files
                    if (entry.name.startsWith('.env')) {
                        categories.get('environment')?.push(entry.name);
                        patterns.push(entry.name);
                    }
                    // Check build outputs
                    if (entry.name.endsWith('.min.js') || entry.name.endsWith('.bundle.js')) {
                        categories.get('build')?.push(entry.name);
                        patterns.push(entry.name);
                    }
                }
            }

            // Add pattern extensions
            const envCategory = categories.get('environment') || [];
            if (envCategory.some(p => p.startsWith('.env'))) {
                envCategory.push('.env.*');
            }

            // Detect large folders
            const largeFolders = await this.detectLargeFolders();
            categories.set('large', largeFolders);

            return {
                categories,
                largeFolders,
                totalPatterns: patterns.length + largeFolders.length
            };
        } catch (error) {
            console.error('Error scanning project:', error);
            return {
                categories,
                largeFolders: [],
                totalPatterns: 0
            };
        }
    }

    /**
     * Detect folders that exceed size threshold
     * @returns Array of large folder paths
     */
    private async detectLargeFolders(): Promise<string[]> {
        const largeFolders: string[] = [];

        try {
            const entries = await fs.readdir(this.cwd, { withFileTypes: true });

            for (const entry of entries) {
                if (!entry.isDirectory()) continue;

                // Skip already known patterns to avoid double-counting
                if (this.isKnownPattern(entry.name)) continue;

                const folderPath = path.join(this.cwd, entry.name);
                const size = await this.getFolderSize(folderPath);

                if (size > SIZE_THRESHOLD_BYTES) {
                    largeFolders.push(entry.name + '/');
                }
            }
        } catch (error) {
            console.error('Error detecting large folders:', error);
        }

        return largeFolders;
    }

    /**
     * Check if folder name matches any known pattern
     */
    private isKnownPattern(folderName: string): boolean {
        for (const patterns of Object.values(KNOWN_PATTERNS)) {
            if (patterns.includes(folderName)) {
                return true;
            }
        }
        return false;
    }

    /**
     * Calculate total size of a folder (recursive)
     * @param folderPath - Path to folder
     * @returns Size in bytes
     */
    private async getFolderSize(folderPath: string): Promise<number> {
        let totalSize = 0;

        try {
            const entries = await fs.readdir(folderPath, { withFileTypes: true });

            for (const entry of entries) {
                const entryPath = path.join(folderPath, entry.name);

                if (entry.isDirectory()) {
                    // Recursive for subdirectories
                    totalSize += await this.getFolderSize(entryPath);
                } else {
                    // Get file size
                    try {
                        const stats = await fs.stat(entryPath);
                        totalSize += stats.size;
                    } catch {
                        // Skip files that can't be accessed
                    }
                }

                // Early exit if already exceeds threshold (performance optimization)
                if (totalSize > SIZE_THRESHOLD_BYTES) {
                    return totalSize;
                }
            }
        } catch (error) {
            // Skip folders that can't be accessed
        }

        return totalSize;
    }

    /**
     * Categorize an array of patterns by their type
     * @param patterns - Array of patterns to categorize
     * @returns Map of categories to patterns
     */
    categorizePatterns(patterns: string[]): Map<IgnoreCategory, string[]> {
        const categories = new Map<IgnoreCategory, string[]>();

        // Initialize all categories
        (['dependencies', 'environment', 'build', 'cache', 'vcs', 'ide', 'large'] as IgnoreCategory[]).forEach(cat => {
            categories.set(cat, []);
        });

        for (const pattern of patterns) {
            let categorized = false;

            // Check against known patterns
            for (const [category, knownPatterns] of Object.entries(KNOWN_PATTERNS)) {
                const cleanPattern = pattern.endsWith('/') ? pattern.slice(0, -1) : pattern;

                if (knownPatterns.includes(cleanPattern) ||
                    knownPatterns.some(kp => pattern.includes(kp))) {
                    categories.get(category as IgnoreCategory)?.push(pattern);
                    categorized = true;
                    break;
                }
            }

            // If not categorized, check by pattern characteristics
            if (!categorized) {
                if (pattern.startsWith('.env')) {
                    categories.get('environment')?.push(pattern);
                } else if (pattern.endsWith('.min.js') || pattern.endsWith('.bundle.js') ||
                    pattern.includes('dist/') || pattern.includes('build/')) {
                    categories.get('build')?.push(pattern);
                } else if (pattern.endsWith('.log') || pattern.includes('cache') ||
                    pattern.includes('tmp') || pattern.includes('temp')) {
                    categories.get('cache')?.push(pattern);
                }
            }
        }

        return categories;
    }

    // ========================================
    // .AIIGNORE GENERATION (Day 3)
    // ========================================

    /**
     * Generate .aiignore file với categorized patterns
     * @param scanResult - Result từ scanProject()
     */
    async generateAiIgnoreFile(scanResult?: ScanResult): Promise<void> {
        const result = scanResult || await this.scanProject();
        const aiignorePath = path.join(this.cwd, '.aiignore');

        // Load existing user-defined patterns
        const existingUserPatterns = await this.loadExistingUserPatterns(aiignorePath);

        // Build file content
        const lines: string[] = [];

        // Header
        lines.push('# Auto-generated by AI Agent');
        lines.push(`# Last updated: ${new Date().toISOString()}`);
        lines.push('# DO NOT EDIT the auto-detected sections unless necessary');
        lines.push('# Add your custom patterns in the "User-defined" section');
        lines.push('');

        // Categories
        const categoryLabels: Record<IgnoreCategory, string> = {
            dependencies: 'Dependencies',
            environment: 'Environment',
            build: 'Build outputs',
            cache: 'Cache/Temp',
            vcs: 'Version Control',
            ide: 'IDE/Editor',
            large: 'Large folders (>10MB)'
        };

        for (const [category, label] of Object.entries(categoryLabels)) {
            const patterns = result.categories.get(category as IgnoreCategory) || [];
            if (patterns.length > 0) {
                lines.push(`# === ${label} (auto-detected) ===`);
                patterns.forEach(pattern => lines.push(pattern));
                lines.push('');
            }
        }

        // User-defined section
        lines.push('# === User-defined ===');
        lines.push('# Add your custom ignore patterns below');
        if (existingUserPatterns.length > 0) {
            existingUserPatterns.forEach(pattern => lines.push(pattern));
        } else {
            lines.push('# Example:');
            lines.push('# my-secret-folder/');
            lines.push('# *.private');
        }
        lines.push('');

        // Include section
        lines.push('# === Include from other files ===');
        if (await fileExistsAtPath(path.join(this.cwd, '.gitignore'))) {
            lines.push('!include .gitignore');
        }
        lines.push('');

        // Write file
        await fs.writeFile(aiignorePath, lines.join('\n'), 'utf8');
        console.log('[IgnoreManager] Generated .aiignore file');
    }

    /**
     * Load existing user-defined patterns từ .aiignore
     */
    private async loadExistingUserPatterns(aiignorePath: string): Promise<string[]> {
        if (!(await fileExistsAtPath(aiignorePath))) {
            return [];
        }

        const content = await fs.readFile(aiignorePath, 'utf8');
        const lines = content.split(/\r?\n/);
        const userPatterns: string[] = [];
        let inUserSection = false;

        for (const line of lines) {
            const trimmed = line.trim();

            if (trimmed === '# === User-defined ===') {
                inUserSection = true;
                continue;
            }

            if (trimmed.startsWith('# === Include')) {
                inUserSection = false;
                break;
            }

            if (inUserSection && trimmed && !trimmed.startsWith('#')) {
                userPatterns.push(trimmed);
            }
        }

        return userPatterns;
    }

    /**
     * Update existing .aiignore file với new auto-detected patterns
     * Preserves user-defined patterns
     */
    async updateAiIgnoreFile(): Promise<void> {
        const result = await this.scanProject();
        await this.generateAiIgnoreFile(result);
        // Reload sau khi update
        await this.loadAiIgnore();
    }

    // ========================================
    // ENHANCED WATCHER (Day 4)
    // ========================================

    private projectWatcher?: FSWatcher;
    private updateTimeout?: NodeJS.Timeout;

    /**
     * Setup enhanced file watcher để monitor project changes
     */
    setupEnhancedWatcher(): void {
        // Watch for new directories in project root
        this.projectWatcher = chokidar.watch(this.cwd, {
            persistent: true,
            ignoreInitial: true,
            depth: 1, // Only watch root level
            ignored: /(^|[\/\\])\../, // Ignore hidden files except specific ones
        });

        this.projectWatcher.on('addDir', (dirPath) => {
            const dirName = path.basename(dirPath);
            console.log(`[IgnoreManager] New directory detected: ${dirName}`);

            // Check if matches known patterns
            if (this.shouldAutoIgnore(dirName)) {
                this.scheduleUpdate();
            }
        });

        this.projectWatcher.on('error', (error) => {
            console.error('[IgnoreManager] Project watcher error:', error);
        });
    }

    /**
     * Check if directory name should be auto-ignored
     */
    private shouldAutoIgnore(dirName: string): boolean {
        // Check against known patterns
        for (const patterns of Object.values(KNOWN_PATTERNS)) {
            if (patterns.includes(dirName)) {
                return true;
            }
        }
        return false;
    }

    /**
     * Schedule debounced update
     */
    private scheduleUpdate(): void {
        if (this.updateTimeout) {
            clearTimeout(this.updateTimeout);
        }

        this.updateTimeout = setTimeout(async () => {
            await this.rescanAndUpdate();
        }, 300); // 300ms debounce
    }

    /**
     * Rescan project and update .aiignore
     */
    async rescanAndUpdate(): Promise<void> {
        console.log('[IgnoreManager] Rescanning project...');

        try {
            await this.updateAiIgnoreFile();
            console.log('[IgnoreManager] Update complete');
        } catch (error) {
            console.error('[IgnoreManager] Update failed:', error);
        }
    }

    /**
     * Initialize với auto-generation nếu .aiignore không tồn tại
     */
    async initializeWithAutoGeneration(): Promise<void> {
        const aiignorePath = path.join(this.cwd, '.aiignore');

        // Generate nếu chưa có
        if (!(await fileExistsAtPath(aiignorePath))) {
            console.log('[IgnoreManager] No .aiignore found, generating...');
            await this.generateAiIgnoreFile();
        }

        // Setup watchers
        this.setupFileWatcher();
        this.setupEnhancedWatcher();

        // Load patterns
        await this.loadAiIgnore();
    }

    /**
     * Enhanced dispose - cleanup all watchers
     */
    async dispose(): Promise<void> {
        if (this.fileWatcher) {
            await this.fileWatcher.close();
            this.fileWatcher = undefined;
        }

        if (this.projectWatcher) {
            await this.projectWatcher.close();
            this.projectWatcher = undefined;
        }

        if (this.updateTimeout) {
            clearTimeout(this.updateTimeout);
            this.updateTimeout = undefined;
        }
    }
}
